import React, { useState } from 'react';
import apiClient from '../../services/api.service';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  DocumentCheckIcon,
  ChartBarIcon,
  LightBulbIcon,
  ArrowPathIcon,
  DocumentArrowDownIcon,
  BeakerIcon,
  ShieldCheckIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';

/**
 * Unified AI-Powered Quality Checker Report Component
 * Works for ALL electrical datasheet types using intelligent AI analysis
 * No hardcoded rules - fully dynamic and adaptable
 */
const AIQualityCheckerReport = ({ datasheetId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [processingSteps, setProcessingSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(null);

  const runAIQualityCheck = async () => {
    try {
      setLoading(true);
      setError(null);
      setProcessingSteps([]);
      setCurrentStep('Initializing quality check...');
      
      // Show step-by-step progress
      const steps = [
        'Validating datasheet data...',
        'Preparing analysis engine...',
        'Running AI quality analysis...',
        'Processing results...',
        'Calculating scores...',
        'Generating recommendations...',
        'Finalizing report...'
      ];
      
      // Simulate step progression for better UX
      let stepIndex = 0;
      const stepInterval = setInterval(() => {
        if (stepIndex < steps.length) {
          setCurrentStep(steps[stepIndex]);
          setProcessingSteps(prev => [...prev, {
            step: stepIndex + 1,
            description: steps[stepIndex],
            timestamp: new Date().toLocaleTimeString(),
            completed: false
          }]);
          stepIndex++;
        }
      }, 800);
      
      const response = await apiClient.post(
        `/electrical-datasheet/datasheets/${datasheetId}/ai-quality-check/`,
        {}
      );
      
      clearInterval(stepInterval);
      
      // Mark all steps as completed
      setProcessingSteps(prev => prev.map(step => ({ ...step, completed: true })));
      setCurrentStep('Quality check completed successfully!');
      
      setReport(response.data);
      setActiveTab('overview');
      
    } catch (err) {
      console.error('Error running AI quality check:', err);
      setCurrentStep('Quality check failed');
      
      // Enhanced error handling
      const errorDetails = err.response?.data;
      let errorMessage = 'Failed to run quality check. Please try again.';
      
      if (errorDetails?.details) {
        errorMessage = errorDetails.details;
      } else if (errorDetails?.error) {
        errorMessage = errorDetails.error;
      }
      
      setError({
        message: errorMessage,
        troubleshooting: errorDetails?.troubleshooting,
        timestamp: new Date().toLocaleString()
      });
    } finally {
      setLoading(false);
      setTimeout(() => {
        setCurrentStep(null);
      }, 2000);
    }
  };

  const getStatusConfig = (status) => {
    const configs = {
      excellent: {
        color: 'bg-green-100 text-green-800 border-green-300',
        icon: <CheckCircleIcon className="w-8 h-8 text-green-600" />,
        label: 'Excellent Quality'
      },
      good: {
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        icon: <CheckCircleIcon className="w-8 h-8 text-blue-600" />,
        label: 'Good Quality'
      },
      acceptable: {
        color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
        icon: <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600" />,
        label: 'Acceptable Quality'
      },
      needs_improvement: {
        color: 'bg-orange-100 text-orange-800 border-orange-300',
        icon: <ExclamationTriangleIcon className="w-8 h-8 text-orange-600" />,
        label: 'Needs Improvement'
      },
      poor: {
        color: 'bg-red-100 text-red-800 border-red-300',
        icon: <XCircleIcon className="w-8 h-8 text-red-600" />,
        label: 'Poor Quality'
      },
      error: {
        color: 'bg-gray-100 text-gray-800 border-gray-300',
        icon: <DocumentCheckIcon className="w-8 h-8 text-gray-600" />,
        label: 'Error'
      }
    };
    return configs[status] || configs.error;
  };

  const getSeverityColor = (severity) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800 border-red-300',
      MAJOR: 'bg-orange-100 text-orange-800 border-orange-300',
      MINOR: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      HIGH: 'bg-red-100 text-red-800 border-red-300',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      LOW: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return colors[severity?.toUpperCase()] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusBadge = (status) => {
    const badges = {
      PASS: 'bg-green-100 text-green-800',
      FAIL: 'bg-red-100 text-red-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      COMPLIANT: 'bg-green-100 text-green-800',
      NON_COMPLIANT: 'bg-red-100 text-red-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
      NOT_APPLICABLE: 'bg-gray-100 text-gray-800',
      VALID: 'bg-green-100 text-green-800',
      INVALID: 'bg-red-100 text-red-800',
      QUESTIONABLE: 'bg-yellow-100 text-yellow-800'
    };
    return badges[status?.toUpperCase()] || 'bg-gray-100 text-gray-800';
  };

  const ScoreCircle = ({ score, label, color }) => (
    <div className="flex flex-col items-center">
      <div className={`relative w-24 h-24 rounded-full border-4 ${color} flex items-center justify-center`}>
        <span className="text-2xl font-bold">{score}%</span>
      </div>
      <span className="mt-2 text-sm font-medium text-gray-700">{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-7xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                  <SparklesIcon className="w-8 h-8 text-white" />
                </div>
                <div className="ml-4">
                  <h3 className="text-xl leading-6 font-bold text-white">
                    {report?.equipment_type ? `${report.equipment_type} Quality Checker` : 'AI Quality Checker'}
                  </h3>
                  <p className="mt-1 text-sm text-indigo-100">
                    {report?.equipment_type ? `Intelligent Analysis for ${report.equipment_type} • Powered by GPT-4` : 'Intelligent Analysis for All Equipment Types • Powered by GPT-4'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors rounded-full p-2 hover:bg-white hover:bg-opacity-10"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="bg-gray-50">
            {!report && !loading && (
              <div className="px-6 py-12">
                <div className="text-center max-w-2xl mx-auto">
                  <div className="inline-flex p-4 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full mb-6">
                    <DocumentCheckIcon className="w-20 h-20 text-indigo-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    {report?.equipment_type ? `Ready to Check ${report.equipment_type} Quality` : 'Ready to Run AI Quality Check'}
                  </h3>
                  <p className="text-gray-600 mb-8 text-lg">
                    {report?.equipment_type ? `Our AI will analyze ${report.equipment_type} datasheet for:` : 'Our advanced AI will perform comprehensive analysis including:'}
                  </p>
                  <div className="grid grid-cols-2 gap-4 mb-8 text-left">
                    <div className="flex items-start space-x-3">
                      <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Data Completeness</p>
                        <p className="text-sm text-gray-500">Identify missing critical fields</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <BeakerIcon className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Technical Validation</p>
                        <p className="text-sm text-gray-500">Check parameter ranges & logic</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <ShieldCheckIcon className="w-6 h-6 text-purple-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Standards Compliance</p>
                        <p className="text-sm text-gray-500">ADNOC & industry standards</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <LightBulbIcon className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-gray-900">Smart Recommendations</p>
                        <p className="text-sm text-gray-500">AI-powered improvement suggestions</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={runAIQualityCheck}
                    className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg shadow-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition hover:scale-105"
                  >
                    <SparklesIcon className="w-6 h-6 mr-2" />
                    Run AI Quality Check
                  </button>
                </div>
              </div>
            )}

            {loading && (
              <div className="px-6 py-16">
                <div className="text-center">
                  <div className="inline-block">
                    <ArrowPathIcon className="w-16 h-16 text-indigo-600 animate-spin mx-auto mb-4" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">AI Analysis in Progress...</h3>
                  <p className="text-gray-600 mb-4">
                    Our AI is performing deep analysis of your datasheet
                  </p>
                  <div className="max-w-md mx-auto">
                    <div className="flex justify-between text-sm text-gray-500 mb-2">
                      <span>Analyzing completeness...</span>
                      <span>✓</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500 mb-2">
                      <span>Checking consistency...</span>
                      <span className="animate-pulse">⌛</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Validating standards...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="px-6 py-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                  <div className="flex">
                    <XCircleIcon className="w-6 h-6 text-red-400 flex-shrink-0" />
                    <div className="ml-3 flex-1">
                      <h3 className="text-lg font-medium text-red-800">Quality Check Failed</h3>
                      <p className="mt-2 text-sm text-red-700">
                        {typeof error === 'string' ? error : error.message}
                      </p>
                      
                      {/* Enhanced error details */}
                      {typeof error === 'object' && error.troubleshooting && (
                        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <h4 className="text-sm font-semibold text-yellow-800 mb-2">💡 Troubleshooting Tips:</h4>
                          <ul className="text-sm text-yellow-700 space-y-1">
                            {error.troubleshooting.common_solutions?.map((solution, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-yellow-600 mt-0.5">•</span>
                                <span>{solution}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Timestamp */}
                      {typeof error === 'object' && error.timestamp && (
                        <p className="mt-2 text-xs text-gray-500">
                          Failed at: {error.timestamp}
                        </p>
                      )}
                      
                      {/* Action buttons */}
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={runAIQualityCheck}
                          className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                        >
                          <ArrowPathIcon className="w-4 h-4" />
                          Try Again
                        </button>
                        <button
                          onClick={() => setError(null)}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-500 hover:text-gray-700"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {report && (
              <div className="space-y-4">
                {/* Overall Score Card */}
                <div className="px-6 pt-6">
                  <div className={`border-2 rounded-xl p-6 shadow-lg ${getStatusConfig(report.status).color}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getStatusConfig(report.status).icon}
                        <div className="ml-4">
                          <h4 className="text-2xl font-bold">{getStatusConfig(report.status).label}</h4>
                          <p className="text-sm mt-1">
                            {report.tag_number} • {report.equipment_type}
                          </p>
                          <p className="text-xs mt-1 opacity-75">
                            Checked: {new Date(report.check_timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-center bg-white bg-opacity-50 rounded-lg p-4">
                        <div className="text-5xl font-bold">{report.overall_score}</div>
                        <div className="text-sm font-medium">Quality Score</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Download Buttons */}
                <div className="px-6">
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl shadow-md p-4 border border-indigo-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <DocumentArrowDownIcon className="w-6 h-6 text-indigo-600 mr-3" />
                        <div>
                          <h5 className="font-semibold text-gray-900">
                            Download {report.equipment_type || 'Quality'} Report
                          </h5>
                          <p className="text-sm text-gray-600">
                            Export {report.equipment_type ? `${report.equipment_type} quality analysis` : 'quality check results'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            window.location.href = `${apiClient.defaults.baseURL}/electrical-datasheet/datasheets/${datasheetId}/download-quality-report-excel/`;
                          }}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all transform hover:scale-105"
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                            <path d="M14 2v6h6"/>
                            <path d="M12 18v-6"/>
                            <path d="M9 15l3 3 3-3"/>
                          </svg>
                          Export Excel
                        </button>
                        <button
                          onClick={() => {
                            window.location.href = `${apiClient.defaults.baseURL}/electrical-datasheet/datasheets/${datasheetId}/download-quality-report-pdf/`;
                          }}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all transform hover:scale-105"
                        >
                          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                            <path d="M14 2v6h6"/>
                            <path d="M12 18v-6"/>
                            <path d="M9 15l3 3 3-3"/>
                          </svg>
                          Export PDF
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="px-6">
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                    <h4 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                      <ChartBarIcon className="w-5 h-5 mr-2 text-indigo-600" />
                      {report.equipment_type ? `${report.equipment_type} Quality Metrics` : 'Quality Metrics Breakdown'}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <ScoreCircle 
                        score={report.completeness?.completion_percentage || 0}
                        label="Completeness"
                        color="border-blue-500 text-blue-600"
                      />
                      <ScoreCircle 
                        score={report.consistency?.consistency_score || 0}
                        label="Consistency"
                        color="border-green-500 text-green-600"
                      />
                      <ScoreCircle 
                        score={report.standards_compliance?.compliance_score || 0}
                        label="Standards"
                        color="border-purple-500 text-purple-600"
                      />
                      <ScoreCircle 
                        score={report.technical_validation?.validation_score || 0}
                        label="Technical"
                        color="border-orange-500 text-orange-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Tabs Navigation */}
                <div className="px-6">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-4">
                      {[
                        { id: 'overview', label: 'Overview', icon: ChartBarIcon },
                        { id: 'completeness', label: 'Completeness', icon: ClipboardDocumentCheckIcon },
                        { id: 'consistency', label: 'Consistency', icon: BeakerIcon },
                        { id: 'standards', label: 'Standards', icon: ShieldCheckIcon },
                        { id: 'recommendations', label: 'Recommendations', icon: LightBulbIcon }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`${
                            activeTab === tab.id
                              ? 'border-indigo-500 text-indigo-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          } whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm flex items-center`}
                        >
                          <tab.icon className="w-5 h-5 mr-2" />
                          {tab.label}
                        </button>
                      ))}
                    </nav>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="px-6 pb-6 min-h-[400px]">
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      {/* Summary */}
                      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                        <h5 className="font-semibold text-gray-900 mb-3">
                          {report.equipment_type ? `${report.equipment_type} Quality Assessment Summary` : 'Executive Summary'}
                        </h5>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{report.summary}</pre>
                      </div>

                      {/* Issues & Warnings Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        {report.issues && report.issues.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <h5 className="font-semibold text-red-900 mb-3 flex items-center">
                              <XCircleIcon className="w-5 h-5 mr-2" />
                              Issues ({report.issues.length})
                            </h5>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {report.issues.map((issue, idx) => (
                                <div key={idx} className="bg-white rounded p-3 text-sm">
                                  <div className="flex items-start justify-between">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                                      {issue.severity}
                                    </span>
                                  </div>
                                  <p className="text-gray-900 font-medium mt-2">{issue.message}</p>
                                  {issue.remediation && (
                                    <p className="text-gray-600 text-xs mt-1">→ {issue.remediation}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {report.warnings && report.warnings.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h5 className="font-semibold text-yellow-900 mb-3 flex items-center">
                              <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                              Warnings ({report.warnings.length})
                            </h5>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {report.warnings.map((warning, idx) => (
                                <div key={idx} className="bg-white rounded p-3 text-sm">
                                  <p className="text-gray-900 font-medium">{warning.message}</p>
                                  {warning.suggestion && (
                                    <p className="text-gray-600 text-xs mt-1">💡 {warning.suggestion}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === 'completeness' && (
                    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                      <h5 className="font-semibold text-gray-900 mb-4">Completeness Analysis</h5>
                      
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Data Completeness</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {report.completeness?.completion_percentage || 0}%
                          </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Fields Filled</p>
                          <p className="text-2xl font-bold text-green-600">
                            {report.completeness?.filled_count || 0}
                          </p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Missing Critical</p>
                          <p className="text-2xl font-bold text-red-600">
                            {report.completeness?.critical_missing || 0}
                          </p>
                        </div>
                      </div>

                      {/* Critical Missing Fields */}
                      {report.completeness?.critical_missing_fields && report.completeness.critical_missing_fields.length > 0 && (
                        <div className="mb-4">
                          <h6 className="font-medium text-red-700 mb-2">Critical Missing Fields:</h6>
                          <div className="space-y-2">
                            {report.completeness.critical_missing_fields.map((field, idx) => {
                              // Handle both object format and string format
                              if (typeof field === 'string') {
                                return (
                                  <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                                    <p className="text-sm text-gray-700">{field}</p>
                                  </div>
                                );
                              }
                              // Object format
                              return (
                                <div key={idx} className="bg-red-50 border border-red-200 rounded p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-900">{field.label || field.field}</span>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(field.importance)}`}>
                                      {field.importance}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-600 mt-1">Section: {field.section}</p>
                                  {field.reason && (
                                    <p className="text-sm text-gray-700 mt-1 italic">{field.reason}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Well Documented Areas */}
                      {report.completeness?.well_documented && report.completeness.well_documented.length > 0 && (
                        <div>
                          <h6 className="font-medium text-green-700 mb-2">Well Documented Areas:</h6>
                          <div className="space-y-2">
                            {report.completeness.well_documented.map((section, idx) => (
                              <div key={idx} className="bg-green-50 border border-green-200 rounded p-3">
                                <span className="text-sm text-gray-700">✓ {section}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Additional Context */}
                      {report.completeness?.expected_fields_count > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-sm text-gray-600">
                            <strong>Expected Fields:</strong> {report.completeness.expected_fields_count} | 
                            <strong className="ml-2">Total Fields:</strong> {report.completeness.total_count || 0}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'consistency' && (
                    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                      <h5 className="font-semibold text-gray-900 mb-4">Consistency Analysis</h5>
                      
                      {/* Summary Stats */}
                      <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Consistency Score</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {report.consistency?.consistency_score || 0}%
                          </p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Checks Performed</p>
                          <p className="text-2xl font-bold text-purple-600">
                            {report.consistency?.checks_performed || 0}
                          </p>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Checks Passed</p>
                          <p className="text-2xl font-bold text-green-600">
                            {report.consistency?.checks_passed || 0}
                          </p>
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Issues Found</p>
                          <p className="text-2xl font-bold text-red-600">
                            {report.consistency?.checks_failed || 0}
                          </p>
                        </div>
                      </div>

                      {/* Consistency Checks */}
                      {report.consistency?.details && report.consistency.details.length > 0 && (
                        <div className="space-y-3 mb-6">
                          <h6 className="font-medium text-gray-900">Detailed Checks:</h6>
                          {report.consistency.details.map((check, idx) => (
                            <div key={idx} className={`border rounded-lg p-4 ${
                              check.status === 'PASS' ? 'bg-green-50 border-green-200' : 
                              check.status === 'FAIL' ? 'bg-red-50 border-red-200' : 
                              'bg-yellow-50 border-yellow-200'
                            }`}>
                              <div className="flex items-start justify-between">
                                <h6 className="font-medium text-gray-900">{check.check_name}</h6>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(check.status)}`}>
                                  {check.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mt-2">{check.details}</p>
                              {check.affected_fields && check.affected_fields.length > 0 && (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-500">
                                    Affected Fields: {check.affected_fields.join(', ')}
                                  </p>
                                </div>
                              )}
                              {check.severity && (
                                <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                                  check.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
                                  check.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {check.severity} Priority
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Logical Issues (if details is empty but logical_issues exists) */}
                      {(!report.consistency?.details || report.consistency.details.length === 0) && 
                       report.consistency?.logical_issues && report.consistency.logical_issues.length > 0 && (
                        <div className="mb-4">
                          <h6 className="font-medium text-yellow-700 mb-2">Logical Issues:</h6>
                          <div className="space-y-2">
                            {report.consistency.logical_issues.map((issue, idx) => (
                              <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                                <p className="text-sm text-gray-700">⚠ {issue}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cross Reference Checks */}
                      {report.consistency?.cross_reference_checks && report.consistency.cross_reference_checks.length > 0 && (
                        <div>
                          <h6 className="font-medium text-green-700 mb-2">Cross-Reference Validations:</h6>
                          <div className="space-y-2">
                            {report.consistency.cross_reference_checks.slice(0, 5).map((check, idx) => (
                              <div key={idx} className="bg-green-50 border border-green-200 rounded p-3">
                                <span className="text-sm text-gray-700">✓ {check}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'standards' && (
                    <div className="space-y-4">
                      {report.standards_compliance?.adnoc_compliance && report.standards_compliance.adnoc_compliance.length > 0 && (
                        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                          <h5 className="font-semibold text-gray-900 mb-4">ADNOC Standards Compliance</h5>
                          <div className="space-y-3">
                            {report.standards_compliance.adnoc_compliance.map((item, idx) => (
                              <div key={idx} className={`border rounded-lg p-4 ${item.status === 'COMPLIANT' ? 'bg-green-50 border-green-200' : item.status === 'NON_COMPLIANT' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                                <div className="flex items-start justify-between">
                                  <h6 className="font-medium text-gray-900">{item.standard_item}</h6>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(item.status)}`}>
                                    {item.status}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-700 mt-2">{item.details}</p>
                                {item.recommendation && (
                                  <p className="text-sm text-blue-700 mt-2 font-medium">→ {item.recommendation}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.standards_compliance?.industry_standards && report.standards_compliance.industry_standards.length > 0 && (
                        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                          <h5 className="font-semibold text-gray-900 mb-4">Industry Standards</h5>
                          <div className="space-y-3">
                            {report.standards_compliance.industry_standards.map((item, idx) => (
                              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                  <h6 className="font-medium text-gray-900">{item.standard}: {item.requirement}</h6>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(item.compliance_status)}`}>
                                    {item.compliance_status}
                                  </span>
                                </div>
                                {item.notes && (
                                  <p className="text-sm text-gray-600 mt-2">{item.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'recommendations' && (
                    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
                      <h5 className="font-semibold text-gray-900 mb-4 flex items-center">
                        <LightBulbIcon className="w-5 h-5 mr-2 text-yellow-500" />
                        AI-Powered Recommendations
                      </h5>
                      {report.recommendations && report.recommendations.length > 0 ? (
                        <div className="space-y-4">
                          {report.recommendations.map((rec, idx) => (
                            <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(rec.priority)}`}>
                                    {rec.priority} Priority
                                  </span>
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                    {rec.category}
                                  </span>
                                  <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                    Effort: {rec.effort}
                                  </span>
                                </div>
                              </div>
                              <p className="text-gray-900 font-medium mb-2">{rec.recommendation}</p>
                              {rec.benefit && (
                                <p className="text-sm text-green-700">✓ Benefit: {rec.benefit}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-center py-8">No recommendations at this time. Great job!</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {report && (
            <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-t border-gray-200">
              <div className="text-sm text-gray-600">
                Powered by GPT-4 • Universal Quality Checker
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={runAIQualityCheck}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ArrowPathIcon className="w-4 h-4 mr-2" />
                  Re-run Check
                </button>
                <button
                  onClick={onClose}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIQualityCheckerReport;
