import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api.service';

/**
 * PIDDesignCheck Component
 * Performs comprehensive P&ID design verification for generated P&ID from PFD
 * Integrates with existing P&ID analysis engine for compliance checks
 * 
 * Features:
 * - Equipment datasheet verification
 * - Instrumentation compliance checks
 * - Safety system validation (PSV, ESD, etc.)
 * - Piping specifications verification
 * - ADNOC/Shell DEP standards compliance
 * - HOLD and NOTES validation
 * - Engineering best practices checks
 */
const PIDDesignCheck = ({ pidConversion, pfdDocument }) => {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('all');

  useEffect(() => {
    // Auto-run verification when component mounts
    if (pidConversion && !analysisResult) {
      runDesignCheck();
    }
  }, [pidConversion]);

  const runDesignCheck = async () => {
    setLoading(true);
    setError('');

    try {
      // Call backend API to perform P&ID verification
      const response = await apiClient.post('/pfd/conversions/verify-pid/', {
        conversion_id: pidConversion.id,
        pfd_document_id: pfdDocument?.id,
        pid_data: pidConversion.pid_data || pidConversion
      });

      setAnalysisResult(response.data);
    } catch (err) {
      console.error('Design check failed:', err);
      setError(err.response?.data?.detail || 'Failed to run design verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Severity badge styling
  const getSeverityBadge = (severity) => {
    const styles = {
      critical: 'bg-red-100 text-red-800 border-red-300',
      major: 'bg-orange-100 text-orange-800 border-orange-300',
      minor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      observation: 'bg-blue-100 text-blue-800 border-blue-300',
      pass: 'bg-green-100 text-green-800 border-green-300'
    };
    return styles[severity] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  // Filter issues by severity
  const filterIssues = (issues) => {
    if (!issues) return [];
    if (selectedSeverity === 'all') return issues;
    return issues.filter(issue => issue.severity === selectedSeverity);
  };

  // Count issues by severity
  const countBySeverity = (issues, severity) => {
    if (!issues) return 0;
    return issues.filter(issue => issue.severity === severity).length;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-600 mx-auto mb-4"></div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Running P&ID Design Verification...</h3>
        <p className="text-gray-600">
          Performing comprehensive checks on equipment, instrumentation, safety systems, and compliance standards
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-red-900 mb-1">Verification Error</h3>
            <p className="text-red-700">{error}</p>
            <button
              onClick={runDesignCheck}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Retry Verification
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!analysisResult) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">P&ID Design Verification</h3>
        <p className="text-gray-600 mb-6">
          Run comprehensive design checks to validate your P&ID against industry standards
        </p>
        <button
          onClick={runDesignCheck}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
        >
          Start Verification
        </button>
      </div>
    );
  }

  const issues = analysisResult.issues || [];
  const filteredIssues = filterIssues(issues);

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-lg border border-green-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900">P&ID Design Verification Report</h2>
          <button
            onClick={runDesignCheck}
            className="px-4 py-2 bg-white text-green-700 border border-green-300 rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Re-run Check
          </button>
        </div>

        {/* Issue Counts */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="text-3xl font-bold text-gray-900">{issues.length}</div>
            <div className="text-sm text-gray-600">Total Findings</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-red-200">
            <div className="text-3xl font-bold text-red-600">{countBySeverity(issues, 'critical')}</div>
            <div className="text-sm text-gray-600">Critical</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-orange-200">
            <div className="text-3xl font-bold text-orange-600">{countBySeverity(issues, 'major')}</div>
            <div className="text-sm text-gray-600">Major</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-yellow-200">
            <div className="text-3xl font-bold text-yellow-600">{countBySeverity(issues, 'minor')}</div>
            <div className="text-sm text-gray-600">Minor</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="text-3xl font-bold text-blue-600">{countBySeverity(issues, 'observation')}</div>
            <div className="text-sm text-gray-600">Observations</div>
          </div>
        </div>
      </div>

      {/* Verification Scope */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
          <svg className="h-6 w-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Verification Scope
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-start">
            <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-gray-900">Equipment Datasheets</div>
              <div className="text-sm text-gray-600">Design pressures, temperatures, materials</div>
            </div>
          </div>
          <div className="flex items-start">
            <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-gray-900">Instrumentation</div>
              <div className="text-sm text-gray-600">Tags, ranges, fail-safe positions</div>
            </div>
          </div>
          <div className="flex items-start">
            <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-gray-900">Safety Systems</div>
              <div className="text-sm text-gray-600">PSVs, ESD, fire & gas detection</div>
            </div>
          </div>
          <div className="flex items-start">
            <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-gray-900">Piping Specifications</div>
              <div className="text-sm text-gray-600">Class, materials, valve types</div>
            </div>
          </div>
          <div className="flex items-start">
            <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-gray-900">Standards Compliance</div>
              <div className="text-sm text-gray-600">ADNOC DEP, API, ISA standards</div>
            </div>
          </div>
          <div className="flex items-start">
            <svg className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-gray-900">HOLDS & NOTES</div>
              <div className="text-sm text-gray-600">Design constraints validation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Severity Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-medium text-gray-700">Filter by Severity:</span>
          <button
            onClick={() => setSelectedSeverity('all')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({issues.length})
          </button>
          <button
            onClick={() => setSelectedSeverity('critical')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'critical'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Critical ({countBySeverity(issues, 'critical')})
          </button>
          <button
            onClick={() => setSelectedSeverity('major')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'major'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            Major ({countBySeverity(issues, 'major')})
          </button>
          <button
            onClick={() => setSelectedSeverity('minor')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'minor'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            }`}
          >
            Minor ({countBySeverity(issues, 'minor')})
          </button>
          <button
            onClick={() => setSelectedSeverity('observation')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedSeverity === 'observation'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Observations ({countBySeverity(issues, 'observation')})
          </button>
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        {filteredIssues.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <svg className="h-16 w-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-semibold text-green-900 mb-2">
              {selectedSeverity === 'all' ? 'No Issues Found!' : `No ${selectedSeverity} issues`}
            </h3>
            <p className="text-green-700">
              {selectedSeverity === 'all' 
                ? 'Your P&ID design passes all verification checks.'
                : `No ${selectedSeverity} severity issues were found in this verification.`}
            </p>
          </div>
        ) : (
          filteredIssues.map((issue, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border-l-4 shadow-sm p-6"
              style={{
                borderLeftColor: issue.severity === 'critical' ? '#dc2626' :
                                 issue.severity === 'major' ? '#ea580c' :
                                 issue.severity === 'minor' ? '#ca8a04' :
                                 issue.severity === 'observation' ? '#2563eb' : '#6b7280'
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-500">#{issue.serial_number || index + 1}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityBadge(issue.severity)}`}>
                    {issue.severity?.toUpperCase() || 'UNKNOWN'}
                  </span>
                  {issue.category && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300">
                      {issue.category}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {issue.pid_reference && (
                  <div>
                    <span className="text-sm font-semibold text-gray-700">Location: </span>
                    <span className="text-sm text-gray-900 font-mono bg-gray-50 px-2 py-1 rounded">
                      {issue.pid_reference}
                    </span>
                  </div>
                )}

                {issue.issue_observed && (
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-1">Issue Observed:</div>
                    <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded">
                      {issue.issue_observed}
                    </div>
                  </div>
                )}

                {issue.action_required && (
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-1">Action Required:</div>
                    <div className="text-sm text-gray-900 bg-blue-50 p-3 rounded border border-blue-200">
                      {issue.action_required}
                    </div>
                  </div>
                )}

                {issue.location_on_drawing && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>
                      Zone: {issue.location_on_drawing.zone || 'Not specified'}
                      {issue.location_on_drawing.coordinates && ` | Coords: ${issue.location_on_drawing.coordinates}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Additional Verification Data */}
      {analysisResult.summary && (
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Verification Summary</h3>
          <div className="prose prose-sm max-w-none">
            <pre className="bg-gray-50 p-4 rounded overflow-auto text-xs">
              {JSON.stringify(analysisResult.summary, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default PIDDesignCheck;
