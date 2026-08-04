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
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const QualityCheckerReport = ({ datasheetId, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const runQualityCheck = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.post(`/electrical-datasheet/datasheets/${datasheetId}/quality_check/`, {});
      
      setReport(response.data);
    } catch (err) {
      console.error('Error running quality check:', err);
      setError('Failed to run quality check. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return <CheckCircleIcon className="w-8 h-8 text-green-600" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-8 h-8 text-yellow-600" />;
      case 'failed':
        return <XCircleIcon className="w-8 h-8 text-red-600" />;
      default:
        return <DocumentCheckIcon className="w-8 h-8 text-gray-600" />;
    }
  };

  const getSeverityBadge = (severity) => {
    const config = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return config[severity] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority) => {
    const config = {
      high: 'bg-red-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-blue-500 text-white'
    };
    return config[priority] || 'bg-gray-500 text-white';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <SparklesIcon className="w-8 h-8 text-white mr-3" />
                <div>
                  <h3 className="text-lg leading-6 font-bold text-white">
                    AI-Powered Quality Checker
                  </h3>
                  <p className="mt-1 text-sm text-indigo-100">
                    Comprehensive Consistency Report & Intelligent Analysis
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[80vh] overflow-y-auto">
            {!report && !loading && (
              <div className="text-center py-12">
                <DocumentCheckIcon className="w-20 h-20 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Run Quality Check</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Our AI will analyze your datasheet for completeness, consistency, standards compliance, and provide intelligent recommendations.
                </p>
                <button
                  onClick={runQualityCheck}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <SparklesIcon className="w-5 h-5 mr-2" />
                  Run Quality Check
                </button>
              </div>
            )}

            {loading && (
              <div className="text-center py-12">
                <ArrowPathIcon className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Analyzing Datasheet...</h3>
                <p className="text-sm text-gray-500">
                  Running comprehensive checks and generating AI-powered insights
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <div className="flex">
                  <XCircleIcon className="w-5 h-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="mt-2 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {report && (
              <div className="space-y-6">
                {/* Overall Score Card */}
                <div className={`border-2 rounded-lg p-6 ${getStatusColor(report.status)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      {getStatusIcon(report.status)}
                      <div className="ml-4">
                        <h4 className="text-xl font-bold">{report.summary.status_text}</h4>
                        <p className="text-sm mt-1">Tag: {report.tag_number} | Type: {report.equipment_type}</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold">{report.overall_score}</div>
                      <div className="text-sm">out of 100</div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
                  <div className="bg-blue-50 overflow-hidden rounded-lg px-4 py-5">
                    <div className="text-sm font-medium text-blue-600 truncate">Completeness</div>
                    <div className="mt-1 text-3xl font-semibold text-blue-900">
                      {report.checks.completeness.completion_percentage}%
                    </div>
                  </div>
                  <div className="bg-green-50 overflow-hidden rounded-lg px-4 py-5">
                    <div className="text-sm font-medium text-green-600 truncate">Consistency</div>
                    <div className="mt-1 text-3xl font-semibold text-green-900">
                      {report.checks.consistency.consistency_score || 100}%
                    </div>
                  </div>
                  <div className="bg-red-50 overflow-hidden rounded-lg px-4 py-5">
                    <div className="text-sm font-medium text-red-600 truncate">Critical Issues</div>
                    <div className="mt-1 text-3xl font-semibold text-red-900">
                      {report.issues.length}
                    </div>
                  </div>
                  <div className="bg-yellow-50 overflow-hidden rounded-lg px-4 py-5">
                    <div className="text-sm font-medium text-yellow-600 truncate">Warnings</div>
                    <div className="mt-1 text-3xl font-semibold text-yellow-900">
                      {report.warnings.length}
                    </div>
                  </div>
                </div>

                {/* Summary Section */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <ChartBarIcon className="w-5 h-5 mr-2 text-indigo-600" />
                    Executive Summary
                  </h4>
                  
                  {report.summary.key_findings.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-medium text-gray-700 mb-2">Key Findings:</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {report.summary.key_findings.map((finding, idx) => (
                          <li key={idx} className="text-sm text-gray-600">{finding}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {report.summary.strengths.length > 0 && (
                    <div className="mb-4">
                      <h5 className="font-medium text-green-700 mb-2">Strengths:</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {report.summary.strengths.map((strength, idx) => (
                          <li key={idx} className="text-sm text-green-600">{strength}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {report.summary.action_required.length > 0 && (
                    <div>
                      <h5 className="font-medium text-red-700 mb-2">Action Required:</h5>
                      <ul className="list-disc list-inside space-y-1">
                        {report.summary.action_required.map((action, idx) => (
                          <li key={idx} className="text-sm text-red-600">{action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Issues Section */}
                {report.issues.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-red-900 mb-4 flex items-center">
                      <XCircleIcon className="w-5 h-5 mr-2" />
                      Critical Issues ({report.issues.length})
                    </h4>
                    <div className="space-y-3">
                      {report.issues.map((issue, idx) => (
                        <div key={idx} className="bg-white rounded-md p-4 border border-red-200">
                          <div className="flex items-start">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(issue.severity)} mr-3`}>
                              {issue.severity}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{issue.category}</p>
                              <p className="text-sm text-gray-600 mt-1">{issue.message}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings Section */}
                {report.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-yellow-900 mb-4 flex items-center">
                      <ExclamationTriangleIcon className="w-5 h-5 mr-2" />
                      Warnings ({report.warnings.length})
                    </h4>
                    <div className="space-y-3">
                      {report.warnings.slice(0, 5).map((warning, idx) => (
                        <div key={idx} className="bg-white rounded-md p-4 border border-yellow-200">
                          <div className="flex items-start">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityBadge(warning.severity)} mr-3`}>
                              {warning.severity}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{warning.check || warning.category}</p>
                              <p className="text-sm text-gray-600 mt-1">{warning.message}</p>
                              {warning.details && (
                                <p className="text-xs text-gray-500 mt-1">{warning.details}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {report.warnings.length > 5 && (
                        <p className="text-sm text-gray-500 text-center">
                          ... and {report.warnings.length - 5} more warnings
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ADNOC Standards Validation Results */}
                {report.checks?.standards_compliance?.adnoc_validation && (
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-300 rounded-lg p-6 mt-6">
                    <h4 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                      <DocumentCheckIcon className="w-5 h-5 mr-2" />
                      ADNOC Standards Validation
                    </h4>
                    
                    {(() => {
                      const adnocValidation = report.checks.standards_compliance.adnoc_validation;
                      
                      if (adnocValidation.status === 'skipped') {
                        return (
                          <div className="text-sm text-gray-600">
                            {adnocValidation.message}
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-4">
                          {/* Compliance Summary */}
                          <div className="grid grid-cols-4 gap-4">
                            <div className="bg-white rounded-lg p-4 border border-purple-200">
                              <div className="text-2xl font-bold text-purple-600">
                                {adnocValidation.voltage_class?.toUpperCase() || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">Voltage Class</div>
                            </div>
                            
                            <div className="bg-white rounded-lg p-4 border border-purple-200">
                              <div className="text-2xl font-bold text-purple-600">
                                {adnocValidation.compliance_percentage || 0}%
                              </div>
                              <div className="text-xs text-gray-600 mt-1">Compliance</div>
                            </div>
                            
                            <div className="bg-white rounded-lg p-4 border border-green-200">
                              <div className="text-2xl font-bold text-green-600">
                                {adnocValidation.checks_passed || 0}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">Checks Passed</div>
                            </div>
                            
                            <div className="bg-white rounded-lg p-4 border border-red-200">
                              <div className="text-2xl font-bold text-red-600">
                                {adnocValidation.checks_failed || 0}
                              </div>
                              <div className="text-xs text-gray-600 mt-1">Checks Failed</div>
                            </div>
                          </div>
                          
                          {/* Standard Source */}
                          {adnocValidation.standard_source && (
                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                              <p className="text-xs text-gray-600">
                                <strong>Reference Standard:</strong> {adnocValidation.standard_source}
                              </p>
                            </div>
                          )}
                          
                          {/* Detailed Validation Results */}
                          {adnocValidation.details && adnocValidation.details.length > 0 && (
                            <div className="mt-4">
                              <h5 className="text-sm font-semibold text-gray-900 mb-3">
                                Detailed Validation Results
                              </h5>
                              <div className="space-y-2">
                                {adnocValidation.details.map((detail, idx) => (
                                  <div
                                    key={idx}
                                    className={`
                                      rounded-lg p-3 border flex items-start
                                      ${detail.status === 'passed' 
                                        ? 'bg-green-50 border-green-300' 
                                        : detail.status === 'failed'
                                        ? 'bg-red-50 border-red-300'
                                        : 'bg-gray-50 border-gray-300'
                                      }
                                    `}
                                  >
                                    <div className="flex-shrink-0 mt-0.5 mr-3">
                                      {detail.status === 'passed' ? (
                                        <CheckCircleIcon className="w-5 h-5 text-green-600" />
                                      ) : detail.status === 'failed' ? (
                                        <XCircleIcon className="w-5 h-5 text-red-600" />
                                      ) : (
                                        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600" />
                                      )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-900">
                                          {detail.check}
                                        </p>
                                        <span className={`
                                          ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                          ${detail.status === 'passed' ? 'bg-green-100 text-green-800' : ''}
                                          ${detail.status === 'failed' ? 'bg-red-100 text-red-800' : ''}
                                          ${detail.status === 'skipped' ? 'bg-gray-100 text-gray-800' : ''}
                                          ${detail.status === 'error' ? 'bg-yellow-100 text-yellow-800' : ''}
                                        `}>
                                          {detail.status}
                                        </span>
                                      </div>
                                      
                                      {detail.value && (
                                        <p className="text-xs text-gray-700 mt-1">
                                          <strong>Actual Value:</strong> {detail.value}
                                        </p>
                                      )}
                                      
                                      {detail.standard_range && (
                                        <p className="text-xs text-gray-700 mt-0.5">
                                          <strong>ADNOC Standard:</strong> {detail.standard_range}
                                        </p>
                                      )}
                                      
                                      {detail.standard && (
                                        <p className="text-xs text-gray-700 mt-0.5">
                                          <strong>Standard:</strong> {detail.standard}
                                        </p>
                                      )}
                                      
                                      {detail.standard_options && (
                                        <p className="text-xs text-gray-700 mt-0.5">
                                          <strong>Approved Options:</strong> {Array.isArray(detail.standard_options) ? detail.standard_options.join(', ') : detail.standard_options}
                                        </p>
                                      )}
                                      
                                      {detail.message && (
                                        <p className="text-xs text-gray-600 mt-1 italic">
                                          {detail.message}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Overall Status Badge */}
                          <div className="mt-4 pt-4 border-t border-purple-200">
                            <div className="flex items-center justify-center">
                              <span className={`
                                px-4 py-2 rounded-full text-sm font-semibold
                                ${adnocValidation.status === 'passed' 
                                  ? 'bg-green-100 text-green-800 border-2 border-green-300' 
                                  : 'bg-red-100 text-red-800 border-2 border-red-300'
                                }
                              `}>
                                {adnocValidation.status === 'passed' 
                                  ? '✓ ADNOC Standards: COMPLIANT' 
                                  : '✗ ADNOC Standards: NON-COMPLIANT'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* AI Insights & Recommendations */}
                {report.recommendations.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-purple-900 mb-4 flex items-center">
                      <LightBulbIcon className="w-5 h-5 mr-2" />
                      AI-Powered Recommendations
                    </h4>
                    <div className="space-y-4">
                      {report.recommendations.map((rec, idx) => (
                        <div key={idx} className="bg-white rounded-md p-4 border border-purple-200">
                          <div className="flex items-start">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityBadge(rec.priority)} mr-3 mt-1`}>
                              {rec.priority}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                              <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                              {rec.potential_benefit && (
                                <div className="mt-2 bg-green-50 rounded-md p-2">
                                  <p className="text-xs text-green-700">
                                    <strong>Benefit:</strong> {rec.potential_benefit}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Checks */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Detailed Check Results</h4>
                  
                  <div className="space-y-4">
                    {/* Completeness Details */}
                    <div className="border-l-4 border-blue-500 pl-4">
                      <h5 className="font-medium text-gray-900">Data Completeness</h5>
                      <p className="text-sm text-gray-600 mt-1">
                        {report.checks.completeness.completed_fields} of {report.checks.completeness.total_fields} fields completed
                      </p>
                      {report.checks.completeness.missing_required.length > 0 && (
                        <p className="text-sm text-red-600 mt-1">
                          {report.checks.completeness.missing_required.length} required fields missing
                        </p>
                      )}
                    </div>

                    {/* Consistency Details */}
                    {report.checks.consistency.total_checks > 0 && (
                      <div className="border-l-4 border-green-500 pl-4">
                        <h5 className="font-medium text-gray-900">Internal Consistency</h5>
                        <p className="text-sm text-gray-600 mt-1">
                          {report.checks.consistency.passed_checks} of {report.checks.consistency.total_checks} checks passed
                        </p>
                        {report.checks.consistency.failed_checks.length > 0 && (
                          <p className="text-sm text-yellow-600 mt-1">
                            {report.checks.consistency.failed_checks.length} consistency checks failed
                          </p>
                        )}
                      </div>
                    )}

                    {/* Standards Compliance */}
                    {report.checks.standards_compliance.applicable_standards.length > 0 && (
                      <div className="border-l-4 border-purple-500 pl-4">
                        <h5 className="font-medium text-gray-900">Standards Compliance</h5>
                        <p className="text-sm text-gray-600 mt-1">
                          Applicable Standards: {report.checks.standards_compliance.applicable_standards.join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Close
            </button>
            {report && (
              <div className="flex space-x-3">
                <button
                  onClick={runQualityCheck}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ArrowPathIcon className="w-4 h-4 mr-2" />
                  Re-run Check
                </button>
                <button
                  onClick={() => {
                    const dataStr = JSON.stringify(report, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `quality-report-${report.tag_number}-${new Date().toISOString().split('T')[0]}.json`;
                    link.click();
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <DocumentArrowDownIcon className="w-4 h-4 mr-2" />
                  Export Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityCheckerReport;
