import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api.service';
import { STORAGE_KEYS } from '../config/app.config';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────────────────
// LINE SIZE VALIDATION PANEL
// Displays AI-generated line size recommendations from Pass 7 of the analysis.
// ─────────────────────────────────────────────────────────────────────────────
const SEVERITY_STYLES = {
  critical:    { badge: 'bg-red-100 text-red-800 border border-red-300',    dot: 'bg-red-500',    label: 'Critical'    },
  major:       { badge: 'bg-orange-100 text-orange-800 border border-orange-300', dot: 'bg-orange-500', label: 'Major' },
  minor:       { badge: 'bg-yellow-100 text-yellow-800 border border-yellow-300', dot: 'bg-yellow-400', label: 'Minor' },
  observation: { badge: 'bg-blue-100 text-blue-800 border border-blue-300',  dot: 'bg-blue-400',   label: 'Observation' },
};

const CHECK_TYPE_LABELS = {
  nozzle_mismatch:    { icon: '🔌', label: 'Nozzle Mismatch' },
  size_jump:          { icon: '↕️', label: 'Unjustified Size Jump' },
  velocity_estimate:  { icon: '💨', label: 'Velocity Estimate' },
  ref_list_mismatch:  { icon: '📋', label: 'Reference List Mismatch' },
  psv_discharge:      { icon: '⚠️', label: 'PSV Discharge Sizing' },
  pump_suction:       { icon: '🔄', label: 'Pump Suction/Discharge' },
  utility_oversized:  { icon: '🔧', label: 'Utility Line Oversized' },
};

const LineSizePanel = ({ recommendations }) => {
  const [expanded, setExpanded] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  const severityCounts = recommendations.reduce((acc, r) => {
    const sev = (r.severity || 'observation').toLowerCase();
    acc[sev] = (acc[sev] || 0) + 1;
    return acc;
  }, {});

  const filtered = activeFilter === 'all'
    ? recommendations
    : recommendations.filter(r => (r.severity || '').toLowerCase() === activeFilter);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-orange-500 mb-6">
      {/* Header */}
      <div
        className="bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-4 border-b border-orange-200 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg">📐</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                AI Line Size Validation
                <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-bold">
                  {recommendations.length} Anomal{recommendations.length === 1 ? 'y' : 'ies'}
                </span>
              </h3>
              <p className="text-sm text-gray-600">
                GPT-4o pass 7 — sizing cross-check against equipment nozzles, continuity &amp; velocity rules
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Severity mini-summary */}
            <div className="hidden sm:flex items-center gap-2">
              {['critical', 'major', 'minor'].map(sev =>
                severityCounts[sev] ? (
                  <span key={sev} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${SEVERITY_STYLES[sev].badge}`}>
                    {severityCounts[sev]} {SEVERITY_STYLES[sev].label}
                  </span>
                ) : null
              )}
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transform transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="p-6">
          {/* Quick-filter pills */}
          <div className="flex flex-wrap gap-2 mb-5">
            {[['all', 'All', `${recommendations.length}`], ...Object.entries(severityCounts).map(([s, c]) => [s, SEVERITY_STYLES[s]?.label || s, c])].map(([filter, label, count]) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  activeFilter === filter
                    ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-orange-300'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          {/* Recommendation Cards */}
          <div className="space-y-4">
            {filtered.map((rec, idx) => {
              const sev = (rec.severity || 'observation').toLowerCase();
              const sevStyle = SEVERITY_STYLES[sev] || SEVERITY_STYLES.observation;
              const checkInfo = CHECK_TYPE_LABELS[rec.check_type] || { icon: '🔍', label: rec.check_type || 'General' };
              const hasRecommendedSize = rec.recommended_size_inch && rec.recommended_size_inch !== 'Verify';
              const confidence = (rec.confidence || 'Medium');
              const confColor = confidence === 'High' ? 'text-green-700 bg-green-50' : confidence === 'Low' ? 'text-red-600 bg-red-50' : 'text-blue-700 bg-blue-50';

              return (
                <div
                  key={idx}
                  className="border-2 border-orange-100 rounded-xl p-4 hover:border-orange-300 hover:shadow-md transition-all bg-gradient-to-r from-white to-orange-50"
                >
                  {/* Card header row */}
                  <div className="flex flex-wrap items-start gap-2 mb-3">
                    {/* Line number badge */}
                    <span className="font-mono font-bold text-base text-gray-900 bg-gray-100 border border-gray-300 px-3 py-1 rounded-lg">
                      {rec.line_number || 'Unknown Line'}
                    </span>

                    {/* Check type */}
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 border border-amber-200 rounded-full font-medium">
                      {checkInfo.icon} {checkInfo.label}
                    </span>

                    {/* Severity */}
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${sevStyle.badge}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${sevStyle.dot}`}></span>
                      {sevStyle.label}
                    </span>

                    {/* Confidence */}
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${confColor}`}>
                      Confidence: {confidence}
                    </span>
                  </div>

                  {/* Size comparison block */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-3">
                    {/* Current size */}
                    <div className="flex-1 bg-red-50 border-2 border-red-200 rounded-lg p-3 text-center">
                      <p className="text-xs text-red-500 font-semibold uppercase tracking-wide mb-1">Annotated on P&ID</p>
                      <p className="text-3xl font-black text-red-700">
                        {rec.current_size_inch ? `${rec.current_size_inch}"` : 'N/A'}
                      </p>
                    </div>

                    {/* Arrow */}
                    <div className="flex items-center justify-center text-2xl text-gray-400">→</div>

                    {/* Recommended size */}
                    <div className={`flex-1 rounded-lg p-3 text-center border-2 ${
                      hasRecommendedSize
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${hasRecommendedSize ? 'text-green-600' : 'text-gray-500'}`}>
                        AI Recommended
                      </p>
                      <p className={`text-3xl font-black ${hasRecommendedSize ? 'text-green-700' : 'text-gray-500'}`}>
                        {hasRecommendedSize ? `${rec.recommended_size_inch}"` : 'Verify'}
                      </p>
                    </div>
                  </div>

                  {/* Engineering basis */}
                  {rec.engineering_basis && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-2 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5 flex-shrink-0">📖</span>
                      <div>
                        <span className="text-xs font-semibold text-blue-700">Engineering Basis: </span>
                        <span className="text-xs text-blue-800">{rec.engineering_basis}</span>
                      </div>
                    </div>
                  )}

                  {/* Reasoning */}
                  {rec.reasoning && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex items-start gap-2">
                      <span className="text-gray-400 mt-0.5 flex-shrink-0">💬</span>
                      <div>
                        <span className="text-xs font-semibold text-gray-600">AI Reasoning: </span>
                        <span className="text-xs text-gray-700">{rec.reasoning}</span>
                      </div>
                    </div>
                  )}

                  {/* Location */}
                  {rec.location_on_drawing?.zone && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <span>📍</span>
                      <span>
                        {rec.location_on_drawing.zone}
                        {rec.location_on_drawing.proximity_description ? ` — ${rec.location_on_drawing.proximity_description}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary Footer */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-orange-50 rounded-lg p-3 text-center border border-orange-200">
              <p className="text-2xl font-bold text-orange-600">{recommendations.length}</p>
              <p className="text-xs text-orange-500">Total Anomalies</p>
            </div>
            {['critical', 'major', 'minor'].map(sev => (
              <div key={sev} className={`rounded-lg p-3 text-center border ${
                sev === 'critical' ? 'bg-red-50 border-red-200' :
                sev === 'major'    ? 'bg-orange-50 border-orange-200' :
                                     'bg-yellow-50 border-yellow-200'
              }`}>
                <p className={`text-2xl font-bold ${
                  sev === 'critical' ? 'text-red-600' :
                  sev === 'major'    ? 'text-orange-600' :
                                       'text-yellow-600'
                }`}>{severityCounts[sev] || 0}</p>
                <p className={`text-xs ${
                  sev === 'critical' ? 'text-red-500' :
                  sev === 'major'    ? 'text-orange-500' :
                                       'text-yellow-500'
                }`}>{SEVERITY_STYLES[sev]?.label}</p>
              </div>
            ))}
          </div>

          {/* Disclaimer */}
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-xs text-amber-700">
              Line size recommendations are generated by AI (GPT-4o) using visual inspection,
              process engineering rules of thumb, and reference data if provided.
              All recommendations <strong>must be verified</strong> by a qualified process engineer
              against hydraulic calculations, process datasheets, and project specifications before any change is made.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

const PIDReport = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [aiAnalysisDetails, setAiAnalysisDetails] = useState(null);
  const [showAiInsights, setShowAiInsights] = useState(false);
  const [showAIDetails, setShowAIDetails] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const pollingRef = useRef(null);

  // Stop polling helper
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  };

  useEffect(() => {
    fetchReport();
    // Cleanup polling on unmount or id change
    return () => stopPolling();
  }, [id]);



  const extractAIInsights = (reportData) => {
    if (!reportData) return null;
    
    // SOFT-CODED: Look for AI metadata in multiple possible locations
    // Priority: analysis_metadata sub-object (service output) → metadata → direct fields
    const analysisData = reportData.analysis_data || reportData.report_data || {};
    const metadata = analysisData.analysis_metadata || analysisData.metadata || {};
    
    return {
      model: metadata.ai_model || analysisData.ai_model || 'GPT-4 Vision (gpt-4o)',
      processingTime: metadata.analysis_duration || metadata.processing_time || analysisData.analysis_duration || 'Multi-pass',
      confidence: metadata.confidence_score || analysisData.confidence_score || analysisData.confidence || 'Good',
      analysisType: metadata.analysis_type || analysisData.analysis_type || 'comprehensive',
      pageCount: metadata.page_count || 1,
      ragContext: metadata.rag_context_used ?? analysisData.rag_context_used ?? false,
      ragContextLength: metadata.rag_context_length || 0,
      tokensUsed: metadata.tokens_used || analysisData.tokens_used || 'N/A',
      temperature: metadata.ai_temperature || 'N/A',
      retryAttempt: metadata.retry_attempt || 1,
      timestamp: metadata.analysis_timestamp ? new Date(metadata.analysis_timestamp).toLocaleString() : 'N/A',
      success: metadata.success !== false,
      // SOFT-CODED: Analysis mode badge — 'standard' or 'premium'
      analysisMode: metadata.analysis_mode || analysisData.analysis_mode || 'standard',
    };
  };

  const renderAIInsightsPanel = () => {
    const aiInsights = extractAIInsights(report);
    if (!aiInsights) return null;

    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-4 sm:p-5 md:p-6 mb-6 sm:mb-8">
        <div 
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer gap-3"
          onClick={() => setShowAIDetails(!showAIDetails)}
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">🤖 AI Analysis Insights</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Powered by {aiInsights.model} • Confidence: {aiInsights.confidence} • {aiInsights.success ? '✅ Success' : '⚠️ Issues'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Analysis Mode Badge */}
            {aiInsights.analysisMode === 'premium' ? (
              <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-violet-100 text-violet-700 border border-violet-200 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Premium
              </div>
            ) : (
              <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-blue-100 text-blue-700 border border-blue-200 text-xs sm:text-sm font-semibold rounded-full whitespace-nowrap">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Standard
              </div>
            )}
            <div className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 text-xs sm:text-sm font-medium rounded-full whitespace-nowrap">
              ⚡ {aiInsights.processingTime}
            </div>
            <svg 
              className={`w-5 h-5 text-gray-500 transform transition-transform ${showAIDetails ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {showAIDetails && (
          <div className="mt-4 sm:mt-5 md:mt-6 space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    🧠
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">AI Model</p>
                    <p className="font-medium text-gray-900">{aiInsights.model}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    📊
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Confidence Score</p>
                    <p className="font-medium text-gray-900">{aiInsights.confidence}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                    🔍
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Analysis Type</p>
                    <p className="font-medium text-gray-900 capitalize">{aiInsights.analysisType}</p>
                  </div>
                </div>
              </div>

              <div className={`bg-white rounded-lg p-4 shadow-sm border ${aiInsights.analysisMode === 'premium' ? 'border-violet-200' : 'border-blue-200'}`}>
                <div className="flex items-center space-x-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${aiInsights.analysisMode === 'premium' ? 'bg-violet-100' : 'bg-blue-100'}`}>
                    {aiInsights.analysisMode === 'premium' ? '✦' : '🛡️'}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Analysis Mode</p>
                    <p className={`font-semibold capitalize ${aiInsights.analysisMode === 'premium' ? 'text-violet-700' : 'text-blue-700'}`}>
                      {aiInsights.analysisMode === 'premium' ? 'Premium' : 'Standard'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                    📄
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pages Analyzed</p>
                    <p className="font-medium text-gray-900">{aiInsights.pageCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                    🔗
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">RAG Context</p>
                    <p className="font-medium text-gray-900">
                      {aiInsights.ragContext ? `✅ Enhanced (${aiInsights.ragContextLength} chars)` : '❌ Standard Analysis'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 shadow-sm border">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                    🔥
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Tokens Used</p>
                    <p className="font-medium text-gray-900">{aiInsights.tokensUsed}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  ⚙️
                </div>
                <h4 className="font-medium text-gray-900">Technical Parameters</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Temperature:</span>
                  <span className="ml-2 font-medium text-gray-900">{aiInsights.temperature}</span>
                </div>
                <div>
                  <span className="text-gray-600">Retry Attempt:</span>
                  <span className="ml-2 font-medium text-gray-900">{aiInsights.retryAttempt}</span>
                </div>
                <div>
                  <span className="text-gray-600">Analysis Time:</span>
                  <span className="ml-2 font-medium text-gray-900">{aiInsights.timestamp}</span>
                </div>
                <div>
                  <span className="text-gray-600">Processing:</span>
                  <span className="ml-2 font-medium text-gray-900">{aiInsights.processingTime}</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  💡
                </div>
                <div>
                  <h4 className="font-medium text-yellow-800 mb-1">AI Analysis Technology</h4>
                  <p className="text-sm text-yellow-700">
                    This report was generated using advanced OpenAI GPT-4 Vision technology, specifically fine-tuned for engineering P&ID analysis. 
                    The AI model analyzes drawings using computer vision and applies engineering knowledge to identify potential issues and observations.
                    {aiInsights.ragContext && " Enhanced with RAG (Retrieval-Augmented Generation) for improved accuracy based on engineering standards."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const fetchReport = async () => {
    try {
      console.log('[PIDReport] Fetching drawing with ID:', id);
      
      // Fetch drawing details
      const drawingResponse = await apiClient.get(`/pid/drawings/${id}/`);
      console.log('[PIDReport] Drawing response:', drawingResponse.data);
      setDrawing(drawingResponse.data);

      // Fetch report if available
      if (drawingResponse.data.status === 'completed') {
        console.log('[PIDReport] Drawing status is completed, fetching report...');
        const reportResponse = await apiClient.get(`/pid/drawings/${id}/report/`);
        console.log('[PIDReport] Report response:', reportResponse.data);
        
        // Enhanced debugging for issues data
        const reportData = reportResponse.data;
        console.log('[PIDReport] Report ID:', reportData.id);
        console.log('[PIDReport] Total issues:', reportData.total_issues);
        console.log('[PIDReport] Issues array:', reportData.issues);
        console.log('[PIDReport] Issues length:', reportData.issues?.length || 'undefined');
        console.log('[PIDReport] Report data keys:', Object.keys(reportData));
        
        // Extract AI analysis details for enhanced display
        if (reportData.report_data) {
          setAiAnalysisDetails({
            model: reportData.report_data.ai_model || 'GPT-4 Vision',
            confidence: reportData.report_data.confidence_score || 'High',
            processingTime: reportData.report_data.analysis_duration || 'N/A',
            tokensUsed: reportData.report_data.tokens_used || 'N/A',
            analysisType: reportData.report_data.analysis_type || 'Comprehensive',
            ragContext: reportData.report_data.rag_context_used || false
          });
        }
        
        if (reportData.issues && reportData.issues.length > 0) {
          console.log('[PIDReport] First issue sample:', reportData.issues[0]);
        } else {
          console.warn('[PIDReport] ⚠️ No issues found in report data!');
          console.log('[PIDReport] Checking report_data field:', reportData.report_data);
        }
        
        setReport(reportData);
      } else if (drawingResponse.data.status === 'processing' || drawingResponse.data.status === 'uploaded') {
        console.log('[PIDReport] Drawing status is:', drawingResponse.data.status, '- starting polling...');
        setLoading(false);
        // Start polling every 10 seconds if not already polling
        if (!pollingRef.current) {
          setIsPolling(true);
          pollingRef.current = setInterval(async () => {
            try {
              const pollResp = await apiClient.get(`/pid/drawings/${id}/`);
              setDrawing(pollResp.data);
              if (pollResp.data.status === 'completed') {
                stopPolling();
                const reportResp = await apiClient.get(`/pid/drawings/${id}/report/`);
                setReport(reportResp.data);
              } else if (pollResp.data.status === 'failed') {
                stopPolling();
                setError(`Analysis failed: ${pollResp.data.error_message || 'Unknown error. Please try re-uploading.'}`);
              }
            } catch (pollErr) {
              console.error('[PIDReport] Polling error:', pollErr);
            }
          }, 10000);
        }
      } else {
        // failed or unknown status
        console.log('[PIDReport] Drawing status is:', drawingResponse.data.status);
        setLoading(false);
      }
      
      if (drawingResponse.data.status === 'completed') setLoading(false);
    } catch (err) {
      console.error('[PIDReport] Error fetching report:', err);
      console.error('[PIDReport] Error response:', err.response);
      console.error('[PIDReport] Error data:', err.response?.data);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to load report';
      
      if (err.response?.status === 404) {
        errorMessage = 'Drawing not found. It may have been deleted.';
      } else if (err.response?.status === 403) {
        errorMessage = 'Access denied. You do not have permission to view this drawing.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Authentication required. Please login again.';
        setTimeout(() => navigate('/login'), 2000);
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (!err.response) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  const handleIssueAction = async (issueId, action, remark = '') => {
    try {
      await apiClient.post(
        `/pid/issues/${issueId}/${action}/`,
        { remark }
      );
      
      // Refresh report
      fetchReport();
    } catch (err) {
      console.error(`Failed to ${action} issue:`, err);
    }
  };

  const handleIssueUpdate = async (issueId, field, value) => {
    try {
      await apiClient.patch(`/pid/issues/${issueId}/`, { [field]: value });
      // Refresh report
      fetchReport();
    } catch (err) {
      console.error(`Failed to update issue:`, err);
    }
  };

  const handleReAnalyze = async () => {
    if (!confirm('This will re-analyze the drawing and regenerate the report with the latest AI model. All manual changes (approvals, remarks) will be preserved. Continue?')) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.post(`/pid/drawings/${id}/analyze/`);
      
      // Wait for analysis to complete (poll every 2 seconds)
      const pollInterval = setInterval(async () => {
        const drawingResponse = await apiClient.get(`/pid/drawings/${id}/`);
        if (drawingResponse.data.status === 'completed') {
          clearInterval(pollInterval);
          fetchReport();
        } else if (drawingResponse.data.status === 'failed') {
          clearInterval(pollInterval);
          setError('Re-analysis failed. Please try again.');
          setLoading(false);
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (loading) {
          setError('Re-analysis timeout. Please refresh the page.');
          setLoading(false);
        }
      }, 300000);
    } catch (err) {
      console.error('Failed to re-analyze:', err);
      alert('Failed to trigger re-analysis. Please try again.');
      setLoading(false);
    }
  };

    const handleExport = (format) => {
    if (!report || !report.issues) {
      alert('No report data available to export');
      return;
    }

    try {
      // Create workbook
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const summaryData = [
        ['P&ID Analysis Report'],
        [''],
        ['Drawing Number', report.pid_drawing_number || 'N/A'],
        ['Total Issues', report.total_issues || 0],
        ['Approved', report.approved_count || 0],
        ['Ignored', report.ignored_count || 0],
        ['Pending', report.pending_count || 0],
        [''],
        ['Issues by Severity'],
        ['Critical', report.issues.filter(i => i.severity === 'critical').length],
        ['Major', report.issues.filter(i => i.severity === 'major').length],
        ['Minor', report.issues.filter(i => i.severity === 'minor').length],
      ];

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Issues Sheet with exact column headers requested
      const issuesData = [
        ['#', 'P&ID Reference', 'Issue Observed', 'Action Required', 'Reason', 'Direction', 'Severity', 'Status', 'Actions']
      ];

      report.issues.forEach((issue, index) => {
        
        // Get direction from location_on_drawing
        let direction = 'N/A';
        if (issue.location_on_drawing) {
          if (typeof issue.location_on_drawing === 'string') {
            try {
              const loc = JSON.parse(issue.location_on_drawing);
              direction = loc.zone || loc.drawing_section || 'N/A';
            } catch {
              direction = 'N/A';
            }
          } else if (typeof issue.location_on_drawing === 'object') {
            direction = issue.location_on_drawing.zone || issue.location_on_drawing.drawing_section || 'N/A';
          }
        }

        const rowData = [
          issue.serial_number || (index + 1),
          (issue.pid_reference || 'N/A') + (issue.category ? ` - ${issue.category}` : ''),
          issue.issue_observed || 'N/A',
          issue.action_required || 'N/A',
          issue.evidence || 'N/A',
          direction,
          issue.severity || 'N/A',
          issue.status || 'pending',
          issue.remark || issue.actions || 'N/A'
        ];

        issuesData.push(rowData);
      });

      const issuesSheet = XLSX.utils.aoa_to_sheet(issuesData);
      XLSX.utils.book_append_sheet(wb, issuesSheet, 'Issues');

      // Generate filename using drawing number for readability
      const timestamp = new Date().toISOString().split('T')[0];
      const drawingRef = report.pid_drawing_number || `DRW-${report.pid_drawing}`;
      const filename = `PID_Report_${drawingRef}_${timestamp}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Export error:', error);
      alert('Error generating Excel file: ' + error.message);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'text-red-700 bg-red-100 border-red-300',
      major: 'text-orange-700 bg-orange-100 border-orange-300',
      minor: 'text-yellow-700 bg-yellow-100 border-yellow-300',
      observation: 'text-blue-700 bg-blue-100 border-blue-300'
    };
    return colors[severity] || colors.observation;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'text-gray-700 bg-gray-100',
      approved: 'text-green-700 bg-green-100',
      ignored: 'text-slate-700 bg-slate-100'
    };
    return colors[status] || colors.pending;
  };

  const getCategoryInfo = (category) => {
    const cat = (category || 'other').toLowerCase().trim();
    const map = {
      instrument:          { label: 'Instrument',           color: 'text-blue-700 bg-blue-100 border-blue-300',      icon: '⚙️' },
      equipment:           { label: 'Equipment',            color: 'text-indigo-700 bg-indigo-100 border-indigo-300', icon: '🏭' },
      piping:              { label: 'Piping',               color: 'text-gray-700 bg-gray-100 border-gray-300',       icon: '🔧' },
      valve:               { label: 'Valve',                color: 'text-cyan-700 bg-cyan-100 border-cyan-300',       icon: '🔩' },
      safety:              { label: 'Safety',               color: 'text-red-700 bg-red-100 border-red-300',          icon: '🚨' },
      control_loop:        { label: 'Control Loop',         color: 'text-purple-700 bg-purple-100 border-purple-300', icon: '🔄' },
      documentation:       { label: 'Documentation',       color: 'text-slate-700 bg-slate-100 border-slate-300',    icon: '📄' },
      legend:              { label: 'Legend',               color: 'text-stone-700 bg-stone-100 border-stone-300',    icon: '📖' },
      pipe_class:          { label: 'Pipe Class',           color: 'text-sky-700 bg-sky-100 border-sky-300',          icon: '📐' },
      psv_compliance:      { label: 'PSV Compliance',       color: 'text-rose-700 bg-rose-100 border-rose-300',       icon: '⚡' },
      holds_compliance:    { label: 'HOLDS',                color: 'text-yellow-700 bg-yellow-100 border-yellow-300', icon: '✋' },
      notes_compliance:    { label: 'Notes',                color: 'text-lime-700 bg-lime-100 border-lime-300',       icon: '📝' },
      trim_class:          { label: 'Trim Class',           color: 'text-violet-700 bg-violet-100 border-violet-300', icon: '🎯' },
      dissimilar_material: { label: 'Dissimilar Material',  color: 'text-pink-700 bg-pink-100 border-pink-300',       icon: '⚗️' },
      ltcs_compliance:     { label: 'LTCS',                 color: 'text-teal-700 bg-teal-100 border-teal-300',       icon: '❄️' },
      free_drain_slope:    { label: 'Drain/Slope',          color: 'text-green-700 bg-green-100 border-green-300',    icon: '📉' },
      spool_requirement:   { label: 'Spool / RO',           color: 'text-amber-700 bg-amber-100 border-amber-300',    icon: '📏' },
      critical_stress:     { label: 'Critical Stress',      color: 'text-orange-700 bg-orange-100 border-orange-300', icon: '💥' },
      valve_standard:      { label: 'Valve Standard',       color: 'text-fuchsia-700 bg-fuchsia-100 border-fuchsia-300', icon: '🔑' },
      tie_in_reference:    { label: 'Tie-in / BL',          color: 'text-blue-900 bg-blue-50 border-blue-400',        icon: '🔗' },
      corrosion_allowance: { label: 'Corrosion / NACE',     color: 'text-emerald-700 bg-emerald-100 border-emerald-300', icon: '🛡️' },
      line_size:           { label: 'Line Size',            color: 'text-orange-700 bg-orange-100 border-orange-300',  icon: '📐' },
    };
    return map[cat] || { label: cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), color: 'text-gray-600 bg-gray-100 border-gray-300', icon: '🔍' };
  };

  // SOFT-CODED: Unified filtering — severity, status, and category with robust normalization
  const filteredIssues = report?.issues?.filter(issue => {
    const issueSeverity = (issue.severity || '').toString().toLowerCase().trim();
    const issueStatus = (issue.status || '').toString().toLowerCase().trim();
    const issueCategory = (issue.category || '').toString().toLowerCase().trim();

    if (filterSeverity !== 'all' && issueSeverity !== filterSeverity.toLowerCase().trim()) return false;
    if (filterStatus !== 'all' && issueStatus !== filterStatus.toLowerCase().trim()) return false;
    if (filterCategory !== 'all' && issueCategory !== filterCategory.toLowerCase().trim()) return false;

    return true;
  }) || [];

  // Derived category counts for badge display (soft-coded: recomputed from filtered issues)
  const categoryCounts = (report?.issues || []).reduce((acc, issue) => {
    const cat = (issue.category || 'other').toLowerCase();
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-gray-600">Loading P&ID Analysis Report...</p>
        </div>
      </div>
    );
  }

  if (error || !drawing) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-800">{error || 'Drawing not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
    <div className="max-w-7xl mx-auto">
      
      {/* Rejlers Professional Header */}
      <div className="mb-6 sm:mb-8 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-xl shadow-xl p-5 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black mb-1">REJLERS</h1>
            <div className="flex items-center space-x-3 mb-2">
              <div className="h-1 w-12 sm:w-16 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full"></div>
              <span className="text-amber-300 text-base sm:text-lg font-semibold">ABU DHABI</span>
            </div>
            <p className="text-blue-200 text-xs sm:text-sm">Engineering & Design Consultancy</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs sm:text-sm text-blue-200">P&ID Analysis Report</p>
            <p className="text-xs text-blue-300 mt-1">Generated: {new Date().toLocaleDateString('en-GB')}</p>
          </div>
        </div>
      </div>

      {/* Processing / Analysis-in-progress banner */}
      {(drawing.status === 'processing' || drawing.status === 'uploaded') && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-start gap-4">
          <svg className="animate-spin h-7 w-7 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div>
            <h3 className="text-base font-semibold text-blue-900">AI Analysis in Progress</h3>
            <p className="text-sm text-blue-700 mt-0.5">
              Your P&ID drawing is being analyzed by the 8-pass AI engine. This typically takes 3–8 minutes.
              This page will automatically refresh when the analysis is complete.
            </p>
          </div>
        </div>
      )}

      {/* Enhanced AI Analysis Insights Panel */}
      {renderAIInsightsPanel()}

      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/dashboard')}
          className="text-blue-600 hover:text-blue-800 mb-4 flex items-center font-medium"
        >
          <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </button>
        
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">P&ID Design Verification Report</h1>
          
                    {/* Export Button */}
          {report && (
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-md transition-colors"
              title="Download report as Excel spreadsheet"
            >
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              Download Excel
            </button>
          )}
        </div>
      </div>

      {/* Drawing Information */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6 border-l-4 border-blue-900">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="h-6 w-6 mr-2 text-blue-900" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
          Drawing Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Drawing Number</p>
            <p className="font-medium text-gray-900 font-mono">{drawing.drawing_number || 'N/A'}</p>
            {drawing.area && drawing.p_area && drawing.doc_code && drawing.serial_number && (
              <p className="text-xs text-gray-500 mt-1">
                Area: {drawing.area} | P/Area: {drawing.p_area} | Doc: {drawing.doc_code} | Serial: {drawing.serial_number}
                {drawing.rev && ` | Rev: ${drawing.rev}`}
                {drawing.sheet_number && drawing.total_sheets && ` | Sheet: ${drawing.sheet_number}/${drawing.total_sheets}`}
              </p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">Title</p>
            <p className="font-medium text-gray-900">{drawing.drawing_title || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Revision</p>
            <p className="font-medium text-gray-900">{drawing.revision || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              drawing.status === 'completed' ? 'bg-green-100 text-green-800' :
              drawing.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
              drawing.status === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {drawing.status ? drawing.status.charAt(0).toUpperCase() + drawing.status.slice(1) : 'Unknown'}
            </span>
          </div>
        </div>
        
        {drawing.project_name && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm text-gray-500">Project</p>
            <p className="font-medium text-gray-900">{drawing.project_name}</p>
          </div>
        )}
      </div>

      {/* Analysis Status */}
      {drawing.status === 'processing' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <svg className="animate-spin h-6 w-6 text-yellow-600 mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>
              <h3 className="font-semibold text-yellow-900">Analysis in Progress</h3>
              <p className="text-sm text-yellow-800">AI is reviewing your P&ID drawing. This may take a few minutes...</p>
              <button
                onClick={() => fetchReport()}
                className="mt-2 text-sm text-yellow-600 hover:text-yellow-800 underline"
              >
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Failed Analysis Status */}
      {drawing.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-red-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-900">Analysis Failed</h3>
              <p className="text-sm text-red-800">The AI analysis encountered an error. Please try uploading the drawing again.</p>
              <button
                onClick={() => navigate('/pid/upload')}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Upload New Drawing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Status - Not Yet Analyzed */}
      {drawing.status === 'uploaded' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-blue-900">Drawing Uploaded</h3>
              <p className="text-sm text-blue-800">This drawing has been uploaded but not yet analyzed.</p>
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    await apiClient.post(`/pid/drawings/${id}/analyze/`);
                    setTimeout(() => fetchReport(), 2000);
                  } catch (err) {
                    console.error('Failed to start analysis:', err);
                    alert('Failed to start analysis. Please try again.');
                    setLoading(false);
                  }
                }}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Start Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Summary */}
      {report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 mb-1">Total Issues</p>
              <p className="text-3xl font-bold text-gray-900">{report.total_issues}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 mb-1">Pending</p>
              <p className="text-3xl font-bold text-gray-600">{report.pending_count}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 mb-1">Approved</p>
              <p className="text-3xl font-bold text-green-600">{report.approved_count}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 mb-1">Ignored</p>
              <p className="text-3xl font-bold text-slate-600">{report.ignored_count}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <p className="text-sm text-gray-500 mb-1">Spec Breaks</p>
              <p className="text-3xl font-bold text-purple-600">
                {report.specification_breaks?.length || 0}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
              <p className="text-sm text-gray-500 mb-1">Line Size</p>
              <p className="text-3xl font-bold text-orange-600">
                {report.line_size_recommendations?.length || 0}
              </p>
              <p className="text-xs text-orange-400 mt-1">AI Anomalies</p>
            </div>
          </div>

          {/* HOLDS & NOTES Compliance Section */}
          {report.holds_and_notes && (report.holds_and_notes.holds_list?.length > 0 || report.holds_and_notes.general_notes_list?.length > 0) && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-red-500 mb-6">
              <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-red-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="h-6 w-6 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  HOLDS & NOTES Compliance
                </h3>
                <p className="text-sm text-gray-600 mt-1">Drawing requirements and design constraints</p>
              </div>

              <div className="p-6">
                {/* HOLDS Section */}
                {report.holds_and_notes.holds_list && report.holds_and_notes.holds_list.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-red-700 mb-3 flex items-center">
                      <span className="bg-red-100 px-2 py-1 rounded mr-2">HOLDS</span>
                      Critical Requirements
                    </h4>
                    <div className="space-y-3">
                      {report.holds_and_notes.holds_list.map((hold, idx) => (
                        <div key={idx} className={`border-l-4 p-4 rounded ${
                          hold.compliance_status === 'Compliant' ? 'border-green-500 bg-green-50' :
                          hold.compliance_status === 'Non-Compliant' ? 'border-red-500 bg-red-50' :
                          'border-yellow-500 bg-yellow-50'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <span className="font-semibold text-sm text-gray-900">{hold.hold_number}</span>
                              <p className="text-sm text-gray-700 mt-1">{hold.hold_description}</p>
                              <p className="text-xs text-gray-600 mt-2 italic">{hold.verification_notes}</p>
                            </div>
                            <span className={`ml-4 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                              hold.compliance_status === 'Compliant' ? 'bg-green-200 text-green-800' :
                              hold.compliance_status === 'Non-Compliant' ? 'bg-red-200 text-red-800' :
                              'bg-yellow-200 text-yellow-800'
                            }`}>
                              {hold.compliance_status}
                            </span>
                          </div>
                          {hold.related_issues && hold.related_issues.length > 0 && (
                            <div className="mt-2 text-xs text-gray-600">
                              Related Issues: {hold.related_issues.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* General NOTES Section */}
                {report.holds_and_notes.general_notes_list && report.holds_and_notes.general_notes_list.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-blue-700 mb-3 flex items-center">
                      <span className="bg-blue-100 px-2 py-1 rounded mr-2">NOTES</span>
                      General Requirements
                    </h4>
                    <div className="space-y-2">
                      {report.holds_and_notes.general_notes_list.slice(0, 10).map((note, idx) => (
                        <div key={idx} className={`border-l-4 p-3 rounded text-sm ${
                          note.compliance_status === 'Compliant' ? 'border-blue-400 bg-blue-50' :
                          note.compliance_status === 'Non-Compliant' ? 'border-orange-500 bg-orange-50' :
                          'border-gray-400 bg-gray-50'
                        }`}>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <span className="font-semibold text-gray-900">{note.note_number}</span>
                              <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded">{note.note_category}</span>
                              <p className="text-gray-700 mt-1">{note.note_text}</p>
                              {note.verification_notes && (
                                <p className="text-xs text-gray-600 mt-1 italic">{note.verification_notes}</p>
                              )}
                            </div>
                            <span className={`ml-4 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                              note.compliance_status === 'Compliant' ? 'bg-green-200 text-green-800' :
                              note.compliance_status === 'Non-Compliant' ? 'bg-orange-200 text-orange-800' :
                              'bg-gray-200 text-gray-800'
                            }`}>
                              {note.compliance_status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {report.holds_and_notes.general_notes_list.length > 10 && (
                        <p className="text-sm text-gray-500 italic text-center py-2">
                          ... and {report.holds_and_notes.general_notes_list.length - 10} more notes
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Critical Violations Alert */}
                {report.holds_and_notes.critical_violations && report.holds_and_notes.critical_violations.length > 0 && (
                  <div className="mt-6 bg-red-100 border-2 border-red-500 rounded-lg p-4">
                    <h5 className="font-bold text-red-800 flex items-center mb-2">
                      <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      Critical Violations Detected
                    </h5>
                    <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
                      {report.holds_and_notes.critical_violations.map((violation, idx) => (
                        <li key={idx}>{violation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Specification Breaks Section */}
          {report.specification_breaks && report.specification_breaks.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-purple-500 mb-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 px-6 py-4 border-b border-purple-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="h-6 w-6 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Specification Breaks ({report.specification_breaks.length})
                </h3>
                <p className="text-sm text-gray-600 mt-1">Piping specification changes (material, pressure class, special requirements)</p>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  {report.specification_breaks.map((specBreak, idx) => (
                    <div key={idx} className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50 hover:shadow-lg transition-shadow">
                      {/* Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                            {specBreak.spec_break_id}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            specBreak.break_properly_marked === 'Yes' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {specBreak.break_properly_marked === 'Yes' ? '✓ Properly Marked' : '⚠ Not Marked'}
                          </span>
                          {specBreak.cost_impact && (
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              specBreak.cost_impact === 'High' ? 'bg-red-100 text-red-700' :
                              specBreak.cost_impact === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {specBreak.cost_impact} Cost Impact
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Location */}
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-700 mb-1">📍 Location:</p>
                        <p className="text-sm text-gray-900 bg-white rounded px-3 py-2 border border-purple-200">
                          {specBreak.location}
                        </p>
                      </div>

                      {/* Spec Comparison */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        {/* Upstream */}
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3">
                          <h5 className="text-xs font-bold text-blue-700 mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            UPSTREAM SPEC
                          </h5>
                          <div className="space-y-1 text-xs">
                            <div><span className="font-semibold">Line:</span> {specBreak.upstream_spec?.line_number}</div>
                            <div><span className="font-semibold">Material:</span> <span className="bg-blue-200 px-2 py-0.5 rounded">{specBreak.upstream_spec?.material_spec}</span></div>
                            <div><span className="font-semibold">Pressure Class:</span> <span className="bg-blue-200 px-2 py-0.5 rounded">{specBreak.upstream_spec?.pressure_class}</span></div>
                            {specBreak.upstream_spec?.special_requirements && specBreak.upstream_spec.special_requirements !== 'None' && (
                              <div><span className="font-semibold">Special:</span> {specBreak.upstream_spec.special_requirements}</div>
                            )}
                          </div>
                        </div>

                        {/* Downstream */}
                        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3">
                          <h5 className="text-xs font-bold text-green-700 mb-2 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                            DOWNSTREAM SPEC
                          </h5>
                          <div className="space-y-1 text-xs">
                            <div><span className="font-semibold">Line:</span> {specBreak.downstream_spec?.line_number}</div>
                            <div><span className="font-semibold">Material:</span> <span className="bg-green-200 px-2 py-0.5 rounded">{specBreak.downstream_spec?.material_spec}</span></div>
                            <div><span className="font-semibold">Pressure Class:</span> <span className="bg-green-200 px-2 py-0.5 rounded">{specBreak.downstream_spec?.pressure_class}</span></div>
                            {specBreak.downstream_spec?.special_requirements && specBreak.downstream_spec.special_requirements !== 'None' && (
                              <div><span className="font-semibold">Special:</span> {specBreak.downstream_spec.special_requirements}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reason & Details */}
                      <div className="space-y-2 text-sm">
                        <div className="bg-white rounded p-2 border border-purple-200">
                          <span className="font-semibold text-purple-700">Reason:</span>
                          <span className="ml-2 text-gray-700">{specBreak.reason_for_break}</span>
                        </div>

                        {specBreak.transition_piece_required === 'Yes' && (
                          <div className="bg-amber-50 rounded p-2 border border-amber-300">
                            <span className="font-semibold text-amber-700">⚙️ Transition Required:</span>
                            <span className="ml-2 text-gray-700">{specBreak.transition_details}</span>
                          </div>
                        )}

                        {specBreak.procurement_impact && (
                          <div className="bg-blue-50 rounded p-2 border border-blue-200">
                            <span className="font-semibold text-blue-700">📦 Procurement:</span>
                            <span className="ml-2 text-gray-700">{specBreak.procurement_impact}</span>
                          </div>
                        )}

                        {specBreak.installation_notes && (
                          <div className="bg-indigo-50 rounded p-2 border border-indigo-200">
                            <span className="font-semibold text-indigo-700">🔧 Installation:</span>
                            <span className="ml-2 text-gray-700 text-xs">{specBreak.installation_notes}</span>
                          </div>
                        )}

                        {/* Issues Found */}
                        {specBreak.issues_found && specBreak.issues_found.length > 0 && (
                          <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
                            <p className="font-semibold text-red-800 text-xs mb-1">⚠️ Issues Identified:</p>
                            <ul className="list-disc list-inside text-xs text-red-700 space-y-0.5">
                              {specBreak.issues_found.map((issue, issueIdx) => (
                                <li key={issueIdx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Stats */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-purple-100 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-purple-700">
                      {report.specification_breaks.length}
                    </p>
                    <p className="text-sm text-purple-600">Total Spec Breaks</p>
                  </div>
                  <div className="bg-green-100 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-700">
                      {report.specification_breaks.filter(sb => sb.break_properly_marked === 'Yes').length}
                    </p>
                    <p className="text-sm text-green-600">Properly Marked</p>
                  </div>
                  <div className="bg-red-100 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-red-700">
                      {report.specification_breaks.filter(sb => sb.issues_found && sb.issues_found.length > 0).length}
                    </p>
                    <p className="text-sm text-red-600">With Issues</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              LINE SIZE VALIDATION & AI RECOMMENDATION PANEL
              ═══════════════════════════════════════════════ */}
          {report.line_size_recommendations && report.line_size_recommendations.length > 0 && (
            <LineSizePanel recommendations={report.line_size_recommendations} />
          )}

          {/* Engineering Category Breakdown */}
          {Object.keys(categoryCounts).length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-5 mb-6 border-l-4 border-blue-600">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Engineering Category Breakdown</h3>
                <span className="text-xs text-gray-500">{report?.issues?.length || 0} total findings</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(categoryCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => {
                    const info = getCategoryInfo(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all hover:shadow-md ${
                          filterCategory === cat
                            ? info.color + ' ring-2 ring-offset-1 ring-current'
                            : info.color + ' opacity-80 hover:opacity-100'
                        }`}
                        title={`Filter by ${info.label}`}
                      >
                        <span>{info.icon}</span>
                        <span>{info.label}</span>
                        <span className="bg-white bg-opacity-60 rounded-full px-1.5 py-0.5 text-xs font-bold">{count}</span>
                      </button>
                    );
                  })}
              </div>
              {filterCategory !== 'all' && (
                <div className="mt-2 flex items-center space-x-2">
                  <span className="text-xs text-blue-700 font-medium">Filtering by: {getCategoryInfo(filterCategory).label}</span>
                  <button onClick={() => setFilterCategory('all')} className="text-xs text-gray-500 hover:text-red-500 underline">Clear filter</button>
                </div>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">Severity:</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => {
                    console.log('[Filter] Severity changed to:', e.target.value);
                    setFilterSeverity(e.target.value);
                  }}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="critical">Critical</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="observation">Observation</option>
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">Category:</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">All ({report?.issues?.length || 0})</option>
                  {/* SOFT-CODED: Category options derived from actual issue data */}
                  {Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                    <option key={cat} value={cat}>{cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ({count})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    console.log('[Filter] Status changed to:', e.target.value);
                    setFilterStatus(e.target.value);
                  }}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="ignored">Ignored</option>
                </select>
              </div>
              
              <div className="ml-auto text-sm text-gray-600 flex items-center">
                Showing <span className="font-semibold mx-1">{filteredIssues.length}</span> of <span className="font-semibold mx-1">{report.total_issues}</span> issues
              </div>
            </div>
          </div>

          {/* Issues Table */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-amber-500">
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Detailed Issues & Observations</h3>
              <p className="text-sm text-gray-600 mt-1">Review and manage each identified issue</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-blue-50">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-blue-50">
                      P&ID Reference
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-blue-50">
                      Issue Observed
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-blue-50">
                      Action Required
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-purple-50">
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <span>Reason</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-amber-50">
                      <div className="flex items-center space-x-1">
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Direction</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-blue-50">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-blue-50">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider bg-blue-50">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredIssues.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-6 py-12 text-center">
                        <div className="space-y-3">
                          <div className="flex justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-lg font-medium text-gray-900">No Issues Found</p>
                            <div className="text-sm text-gray-600 mt-2 space-y-1">
                              {report?.total_issues > 0 ? (
                                <>
                                  <p>Report indicates {report.total_issues} issues, but they're not displaying.</p>
                                  <p className="text-blue-600">Please check the browser console for debugging information.</p>
                                  <p className="text-orange-600">This may be a data serialization issue.</p>
                                </>
                              ) : (
                                <>
                                  <p>The P&ID analysis completed successfully with no issues identified.</p>
                                  <p className="text-green-600">Your drawing appears to comply with all standards.</p>
                                </>
                              )}
                            </div>
                            {report?.total_issues > 0 && (
                              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-left">
                                <p className="text-xs text-yellow-800 font-medium">Debug Information:</p>
                                <p className="text-xs text-yellow-700">Report ID: {report?.id}</p>
                                <p className="text-xs text-yellow-700">Total Issues: {report?.total_issues}</p>
                                <p className="text-xs text-yellow-700">Issues Array: {report?.issues ? `Length ${report.issues.length}` : 'undefined'}</p>
                                <p className="text-xs text-yellow-700">Applied Filters: Severity={filterSeverity}, Status={filterStatus}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredIssues.map((issue, idx) => (
                    <tr key={issue.id} className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                        {issue.serial_number}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900">
                        <span className="font-semibold text-blue-900">{issue.pid_reference}</span>
                        {issue.category && (() => {
                          const info = getCategoryInfo(issue.category);
                          return (
                            <span className={`block mt-1 inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium border ${info.color}`}>
                              <span>{info.icon}</span>
                              <span>{info.label}</span>
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 max-w-md">
                        {issue.issue_observed}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 max-w-md">
                        {issue.action_required}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700 max-w-xs">
                        {issue.evidence ? (
                          <div className="bg-purple-50 border border-purple-200 rounded p-2 text-xs text-purple-900 leading-relaxed italic">
                            {issue.evidence}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs italic">No evidence recorded</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {issue.location_on_drawing ? (
                          <div className="space-y-2">
                            {/* Zone Indicator with Visual Grid */}
                            <div className="flex items-center space-x-2">
                              <div className="relative w-12 h-12 border-2 border-gray-300 rounded grid grid-cols-3 grid-rows-3 gap-0.5 bg-gray-100">
                                {['Top-Left', 'Top-Center', 'Top-Right', 'Middle-Left', 'Middle-Center', 'Middle-Right', 'Bottom-Left', 'Bottom-Center', 'Bottom-Right'].map((zone, idx) => (
                                  <div
                                    key={idx}
                                    className={`${
                                      issue.location_on_drawing.zone === zone
                                        ? 'bg-amber-500'
                                        : 'bg-gray-200'
                                    } transition-colors`}
                                    title={zone}
                                  />
                                ))}
                              </div>
                              <div className="text-xs">
                                <div className="font-semibold text-amber-700">{issue.location_on_drawing.zone}</div>
                                <div className="text-gray-500 text-xs">{issue.location_on_drawing.drawing_section}</div>
                              </div>
                            </div>
                            
                            {/* Proximity Description */}
                            {issue.location_on_drawing.proximity_description && (
                              <div className="text-xs bg-blue-50 rounded px-2 py-1 border border-blue-200">
                                <svg className="w-3 h-3 inline mr-1 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-blue-800">{issue.location_on_drawing.proximity_description}</span>
                              </div>
                            )}
                            
                            {/* Visual Cues */}
                            {issue.location_on_drawing.visual_cues && (
                              <div className="text-xs bg-green-50 rounded px-2 py-1 border border-green-200">
                                <svg className="w-3 h-3 inline mr-1 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span className="text-green-800 italic">{issue.location_on_drawing.visual_cues}</span>
                              </div>
                            )}
                            
                            {/* Search Keywords */}
                            {issue.location_on_drawing.search_keywords && issue.location_on_drawing.search_keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {issue.location_on_drawing.search_keywords.slice(0, 3).map((keyword, kidx) => (
                                  <span key={kidx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-300">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">Location not specified</div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select
                          value={issue.severity}
                          onChange={(e) => handleIssueUpdate(issue.id, 'severity', e.target.value)}
                          className={`w-full px-3 py-1.5 text-xs font-semibold rounded-md border-2 ${getSeverityColor(issue.severity)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        >
                          <option value="critical">Critical</option>
                          <option value="major">Major</option>
                          <option value="minor">Minor</option>
                          <option value="observation">Observation</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select
                          value={issue.status}
                          onChange={(e) => handleIssueUpdate(issue.id, 'status', e.target.value)}
                          className={`w-full px-3 py-1.5 text-xs font-semibold rounded-md ${getStatusColor(issue.status)} cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 border-2 transition-all`}
                        >
                          <option value="pending">Pending</option>
                          <option value="approved">Approved</option>
                          <option value="ignored">Ignored</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleIssueAction(issue.id, 'approve')}
                            className={`px-3 py-1 rounded-md font-medium transition-colors ${
                              issue.status === 'approved' 
                                ? 'bg-green-100 text-green-700 cursor-default' 
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                            disabled={issue.status === 'approved'}
                          >
                            {issue.status === 'approved' ? '✓ Approved' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleIssueAction(issue.id, 'ignore')}
                            className={`px-3 py-1 rounded-md font-medium transition-colors ${
                              issue.status === 'ignored' 
                                ? 'bg-gray-100 text-gray-700 cursor-default' 
                                : 'bg-gray-600 text-white hover:bg-gray-700'
                            }`}
                            disabled={issue.status === 'ignored'}
                          >
                            {issue.status === 'ignored' ? '✓ Ignored' : 'Ignore'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Professional Footer */}
          <div className="mt-8 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-lg shadow-lg p-6 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black mb-1">REJLERS ABU DHABI</h3>
                <p className="text-blue-200 text-sm">Engineering & Design Consultancy</p>
                <p className="text-blue-300 text-xs mt-2">
                  This is a confidential engineering document. Unauthorized distribution is prohibited.
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-blue-200">AI-Powered P&ID Verification System</p>
                <p className="text-blue-300 text-xs mt-1">Generated: {new Date().toLocaleString('en-GB')}</p>
                <p className="text-blue-400 text-xs mt-2">
                  <a href="https://www.rejlers.com/ae/" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 transition-colors">
                    www.rejlers.com/ae
                  </a>
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {drawing.status === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="font-semibold text-red-900 mb-2">Analysis Failed</h3>
          <p className="text-sm text-red-800">The analysis could not be completed. Please try uploading the drawing again.</p>
          <button
            onClick={() => navigate('/pid/upload')}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Upload New Drawing
          </button>
        </div>
      )}
    </div>
    </div>
  );
};

export default PIDReport;

