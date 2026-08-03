import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../services/api.service';
import PIDEngineeringResults from '../components/PIDEngineeringResults';
import PID2DGenerator from '../components/pid/PID2DGenerator';
import PIDDesignCheck from '../components/pid/PIDDesignCheck';

/**
 * PFD Conversion Results & P&ID Generation Page
 * Shows extracted PFD data and auto-generates P&ID using AI
 * Uses 3-Step Engineering Workflow Display Component
 * Includes P&ID Design Check for verification
 */
const PFDConvert = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  
  const [pfdDocument, setPfdDocument] = useState(null);
  const [pidConversion, setPidConversion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('pfd');
  const [viewMode, setViewMode] = useState('specifications'); // 'specifications', '2d-diagram', 'design-check'

  useEffect(() => {
    loadPFDDocument();
  }, [documentId]);

  useEffect(() => {
    // Auto-generate P&ID once PFD data is loaded
    if (pfdDocument && pfdDocument.status === 'converted' && !pidConversion && !autoGenerating) {
      setAutoGenerating(true);
      autoGeneratePID();
    }
  }, [pfdDocument]);

  const loadPFDDocument = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/pfd/documents/${documentId}/`);
      setPfdDocument(response.data);
      
      // Check if P&ID already exists
      if (response.data.status === 'converted') {
        checkExistingPID();
      }
    } catch (err) {
      console.error('Failed to load PFD document:', err);
      setError('Failed to load PFD document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingPID = async () => {
    try {
      const response = await apiClient.get(`/pfd/conversions/?pfd_document=${documentId}`);
      if (response.data.results && response.data.results.length > 0) {
        setPidConversion(response.data.results[0]);
      }
    } catch (err) {
      console.error('Failed to check existing P&ID:', err);
    }
  };

  const autoGeneratePID = async () => {
    if (!pfdDocument || !pfdDocument.extracted_data) {
      setAutoGenerating(false);
      return;
    }

    try {
      setGenerating(true);
      
      // Generate P&ID drawing number based on PFD
      const pfdNumber = pfdDocument.document_number || 'PFD-001';
      const pidNumber = pfdNumber.replace('PFD', 'P&ID');
      
      const requestData = {
        pfd_document_id: documentId,
        pid_drawing_number: pidNumber,
        pid_title: pfdDocument.document_title || 'Generated P&ID',
        pid_revision: pfdDocument.revision || 'A',
      };

      // Use extended timeout for P&ID generation (5 minutes for AI processing)
      const response = await apiClient.post('/pfd/conversions/generate/', requestData, {
        timeout: 300000 // 5 minutes for OpenAI API calls
      });
      
      setPidConversion(response.data);
      setActiveTab('pid');
      
    } catch (err) {
      console.error('P&ID generation failed:', err);
      
      // Smart error handling based on error type
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        // Timeout error - check if generation actually completed
        console.log('⏱️ Request timed out, checking if generation completed in background...');
        
        // Poll for completion
        try {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          await checkExistingPID(); // Check if PID was generated
          
          if (pidConversion) {
            console.log('✅ P&ID generation completed successfully despite timeout');
            setActiveTab('pid');
            return;
          }
        } catch (pollErr) {
          console.error('Polling failed:', pollErr);
        }
        
        setError('P&ID generation is taking longer than expected. The process may still be running in the background. Please refresh the page in a few moments.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.detail || 'P&ID generation failed. Please try again.');
      }
    } finally {
      setGenerating(false);
      setAutoGenerating(false);
    }
  };

  const regeneratePID = async () => {
    setGenerating(true);
    await autoGeneratePID();
  };

  const generateIntelligentPID = async () => {
    if (!pfdDocument) {
      return;
    }

    try {
      setGenerating(true);
      
      // Generate P&ID drawing number
      const pfdNumber = pfdDocument.document_number || 'PFD-001';
      const pidNumber = pfdNumber.replace('PFD', 'P&ID') + '-INT';
      
      const requestData = {
        pfd_document_id: documentId,
        pid_drawing_number: pidNumber,
        pid_title: (pfdDocument.document_title || 'Generated P&ID') + ' (Intelligent)',
        pid_revision: pfdDocument.revision || 'A',
        // reference_pid_path can be provided by user or use default
      };

      // Extended timeout for intelligent generation (AI pattern learning)
      const response = await apiClient.post('/pfd/conversions/intelligent-generate/', requestData, {
        timeout: 360000 // 6 minutes for pattern learning + generation
      });
      
      setPidConversion(response.data);
      setActiveTab('pid');
      
    } catch (err) {
      console.error('Intelligent P&ID generation failed:', err);
      
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Intelligent P&ID generation is taking longer than expected. The process may still be running. Please refresh the page in a few moments.');
      } else {
        setError(err.response?.data?.error || err.response?.data?.detail || 'Intelligent P&ID generation failed. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const downloadPIDSpec = () => {
    if (!pidConversion) return;
    
    const dataStr = JSON.stringify(pidConversion, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pidConversion.pid_drawing_number || 'PID'}_specifications.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPIDDrawing = async () => {
    if (!pidConversion || !pidConversion.id) return;
    
    try {
      const response = await apiClient.get(
        `/pfd/conversions/${pidConversion.id}/download_drawing/`,
        { responseType: 'blob' }
      );
      
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${pidConversion.pid_drawing_number || 'PID'}_Drawing.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download P&ID drawing:', err);
      const errorMsg = err.response?.data?.error || 'P&ID drawing not available or download failed';
      alert(`Download Failed: ${errorMsg}\n\nThe P&ID drawing may not have been generated yet. This feature requires DALL-E API access.`);
    }
  };

  const loadToCanvas = async (conversionId) => {
    if (!conversionId) return;
    
    try {
      // Show loading notification
      const loadingToast = document.createElement('div');
      loadingToast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3';
      loadingToast.innerHTML = `
        <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>🎨 Converting P&ID to canvas format...</span>
      `;
      document.body.appendChild(loadingToast);
      
      // Call API to convert P&ID to canvas data
      const response = await apiClient.get(
        `/pfd/conversions/${conversionId}/load-to-canvas/`
      );
      
      // Remove loading notification
      document.body.removeChild(loadingToast);
      
      const canvasData = response.data;
      
      console.log('Canvas data loaded:', canvasData);
      console.log('Equipment items:', canvasData.equipment?.length || 0);
      console.log('Instruments:', canvasData.instrumentation?.length || 0);
      
      // Store canvas data in sessionStorage for the editor to pick up
      sessionStorage.setItem('canvasLoadData', JSON.stringify(canvasData));
      
      // Switch to 2D diagram view mode to load the canvas
      setViewMode('2d-diagram');
      
      // Show success notification
      const successToast = document.createElement('div');
      successToast.className = 'fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3';
      successToast.innerHTML = `
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>✅ P&ID loaded into Expert Mode canvas! ${canvasData.equipment?.length || 0} equipment, ${canvasData.instrumentation?.length || 0} instruments</span>
      `;
      document.body.appendChild(successToast);
      
      setTimeout(() => {
        document.body.removeChild(successToast);
      }, 5000);
      
    } catch (err) {
      console.error('Failed to load P&ID to canvas:', err);
      const errorMsg = err.response?.data?.error || 'Failed to convert P&ID to canvas format';
      const detail = err.response?.data?.detail || 'The P&ID may not be available or the conversion service may be unavailable.';
      
      alert(`Canvas Load Failed: ${errorMsg}\n\n${detail}\n\nThis feature uses GPT-4 Vision to extract elements from the P&ID drawing.`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading PFD data...</p>
        </div>
      </div>
    );
  }

  if (error && !pfdDocument) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <svg className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/pfd/upload')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Back to Upload
            </button>
          </div>
        </div>
      </div>
    );
  }

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

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {pfdDocument?.document_title || 'PFD Conversion'}
                </h1>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  {pfdDocument?.document_number && (
                    <div className="flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span>{pfdDocument.document_number}</span>
                    </div>
                  )}
                  {pfdDocument?.revision && (
                    <div className="flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span>Rev {pfdDocument.revision}</span>
                    </div>
                  )}
                  {pfdDocument?.project_name && (
                    <div className="flex items-center">
                      <svg className="h-4 w-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>{pfdDocument.project_name}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Status Badge */}
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                pfdDocument?.status === 'converted' ? 'bg-green-100 text-green-800' :
                pfdDocument?.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {pfdDocument?.status === 'converted' ? '✓ Extracted' :
                 pfdDocument?.status === 'processing' ? '⏳ Processing' :
                 '✗ Failed'}
              </div>
            </div>
          </div>
        </div>

        {/* Auto-Generation Banner */}
        {autoGenerating && (
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl shadow-lg p-6 mb-6 text-white">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white mr-4"></div>
              <div>
                <h3 className="text-lg font-semibold mb-1">🚀 Generating Professional P&ID...</h3>
                <p className="text-purple-100">Using programmatic CAD-style generator with ISA 5.1 standards and ROBOFLOW specifications</p>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && pfdDocument && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex">
                <svg className="h-5 w-5 text-red-400 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-red-800 font-medium">Generation Error</h4>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setError('');
                  loadPFDDocument(); // Refresh to check if PID was generated
                }}
                className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex-shrink-0"
              >
                🔄 Check Status
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex relative z-10">
              <button
                onClick={() => setActiveTab('pfd')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors cursor-pointer ${
                  activeTab === 'pfd'
                    ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                type="button"
              >
                <span className="flex items-center justify-center">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Extracted PFD Data
                </span>
              </button>
              <button
                onClick={() => setActiveTab('pid')}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors cursor-pointer ${
                  activeTab === 'pid'
                    ? 'border-b-2 border-purple-600 text-purple-600 bg-purple-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
                type="button"
                style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
              >
                <span className="flex items-center justify-center">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                  </svg>
                  Generated P&ID
                  {generating && <span className="ml-2 animate-pulse">⏳</span>}
                </span>
              </button>
            </nav>
          </div>

          <div className="p-6">
            {/* PFD Data Tab */}
            {activeTab === 'pfd' && pfdDocument?.extracted_data && (
              <div className="space-y-6">
                {/* Check if data has 3-step structure */}
                {(pfdDocument.extracted_data.step1_core_extraction || 
                  pfdDocument.extracted_data.step2_pid_structure || 
                  pfdDocument.extracted_data.step3_detailed_engineering) ? (
                  <PIDEngineeringResults data={pfdDocument.extracted_data} />
                ) : (
                  <PFDDataView data={pfdDocument.extracted_data} />
                )}
              </div>
            )}

            {/* P&ID Tab */}
            {activeTab === 'pid' && (
              <div className="space-y-6">
                {generating ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-600 mx-auto mb-4"></div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Generating P&ID Specifications...</h3>
                    <p className="text-gray-600 mb-4">
                      AI is analyzing PFD data using 3-step engineering workflow and creating detailed P&ID specifications with instrumentation, piping, and safety systems
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto mt-6">
                      <p className="text-sm text-blue-800">
                        <strong>⏱️ This process may take 2-5 minutes</strong> as we're making multiple AI calls to generate comprehensive P&ID specifications.
                      </p>
                      <p className="text-xs text-blue-600 mt-2">
                        If this takes longer, don't worry - the process is still running in the background. You can refresh the page in a few moments to check the results.
                      </p>
                    </div>
                  </div>
                ) : pidConversion ? (
                  <>
                    {/* View Mode Selector - 3 Options */}
                    <div className="flex gap-3 mb-6 flex-wrap">
                      <button
                        onClick={() => setViewMode('specifications')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                          viewMode === 'specifications'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        📋 Specifications View
                      </button>
                      <button
                        onClick={() => setViewMode('2d-diagram')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                          viewMode === '2d-diagram'
                            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                        </svg>
                        📐 2D P&ID Diagram (Expert Mode)
                      </button>
                      <button
                        onClick={() => setViewMode('design-check')}
                        className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                          viewMode === 'design-check'
                            ? 'bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        ✅ P&ID Design Check
                      </button>
                    </div>

                    {/* Conditional View Rendering */}
                    {viewMode === '2d-diagram' ? (
                      <PID2DGenerator 
                        pidData={pidConversion.pid_data || pidConversion} 
                        pfdData={pfdDocument?.extracted_data}
                      />
                    ) : viewMode === 'design-check' ? (
                      <PIDDesignCheck 
                        pidConversion={pidConversion}
                        pfdDocument={pfdDocument}
                      />
                    ) : (
                      <>
                        {/* Original Specifications View */}
                        {/* Check if PID data has 3-step structure */}
                        {(pidConversion.step1_core_extraction || 
                          pidConversion.step2_pid_structure || 
                          pidConversion.step3_detailed_engineering ||
                          pidConversion.pid_data?.step1_core_extraction) ? (
                          <>
                            <PIDEngineeringResults data={pidConversion.pid_data || pidConversion} />
                            {/* Action Buttons */}
                            <div className="flex gap-4">
                              <button
                                onClick={regeneratePID}
                                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors flex items-center"
                              >
                                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Regenerate P&ID
                              </button>
                              <button
                                onClick={() => loadToCanvas(pidConversion.id)}
                                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 font-medium transition-colors flex items-center shadow-lg"
                              >
                                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                ✏️ Edit in Canvas (Expert Mode)
                              </button>
                              <button
                                onClick={downloadPIDSpec}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors flex items-center"
                              >
                                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download JSON
                              </button>
                              <button
                                onClick={downloadPIDDrawing}
                                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center"
                              >
                                <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Download P&ID Drawing
                              </button>
                            </div>
                          </>
                        ) : (
                          <PIDView 
                            data={pidConversion} 
                            onRegenerate={regeneratePID}
                            onDownload={downloadPIDSpec}
                            onDownloadDrawing={downloadPIDDrawing}
                          />
                        )}
                      </>
                    )
                    }
                  </>
                ) : (
                  <div className="text-center py-12">
                    <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No P&ID Generated Yet</h3>
                    <p className="text-gray-600 mb-6">Generate a P&ID from the extracted PFD data using AI</p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-2xl mx-auto">
                      {/* Standard Generation */}
                      <div className="flex-1 w-full">
                        <button
                          onClick={autoGeneratePID}
                          className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-medium transition-all shadow-lg flex items-center justify-center"
                        >
                          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          🚀 Standard Generation
                        </button>
                        <p className="text-xs text-gray-500 mt-2">Fast AI generation with industry standards</p>
                      </div>
                      
                      {/* Intelligent Generation */}
                      <div className="flex-1 w-full">
                        <button
                          onClick={generateIntelligentPID}
                          className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 font-medium transition-all shadow-lg flex items-center justify-center border-2 border-blue-400"
                        >
                          <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          🧠 Intelligent Generation
                        </button>
                        <p className="text-xs text-gray-500 mt-2">AI learns from reference P&IDs for exact style matching</p>
                      </div>
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg max-w-2xl mx-auto text-left">
                      <h4 className="font-semibold text-blue-900 mb-2">💡 What's the difference?</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• <strong>Standard:</strong> Fast generation using pre-configured rules (~2 min)</li>
                        <li>• <strong>Intelligent:</strong> Learns style from your reference P&IDs (~6 min)</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// PFD Data View Component
const PFDDataView = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* Equipment Section */}
      {data.equipment && data.equipment.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="h-6 w-6 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Equipment ({data.equipment.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.equipment.map((item, index) => (
              <div key={index} className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{item.tag || 'No Tag'}</h4>
                  <span className="px-2 py-1 bg-purple-200 text-purple-800 text-xs rounded-full">
                    {item.type || 'Unknown'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{item.description || 'No description'}</p>
                {item.specifications && Object.keys(item.specifications).length > 0 && (
                  <div className="text-xs text-gray-600 space-y-1">
                    {Object.entries(item.specifications).map(([key, value]) => (
                      value && <div key={key}><span className="font-medium">{key}:</span> {value}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Process Streams Section */}
      {data.process_streams && data.process_streams.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Process Streams ({data.process_streams.length})
          </h3>
          <div className="space-y-3">
            {data.process_streams.map((stream, index) => (
              <div key={index} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="font-semibold text-gray-900">{stream.from_equipment || 'Source'}</span>
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="font-semibold text-gray-900">{stream.to_equipment || 'Destination'}</span>
                  </div>
                  {stream.phase && (
                    <span className="px-3 py-1 bg-blue-200 text-blue-800 text-sm rounded-full">
                      {stream.phase}
                    </span>
                  )}
                </div>
                {stream.description && (
                  <p className="text-sm text-gray-700 mt-2">{stream.description}</p>
                )}
                {(stream.flow_rate || stream.temperature || stream.pressure) && (
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                    {stream.flow_rate && <div>Flow: {stream.flow_rate}</div>}
                    {stream.temperature && <div>Temp: {stream.temperature}</div>}
                    {stream.pressure && <div>Press: {stream.pressure}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON View */}
      <div>
        <details className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <summary className="cursor-pointer font-semibold text-gray-900 hover:text-purple-600">
            View Complete Extracted Data (JSON)
          </summary>
          <pre className="mt-4 text-xs text-gray-700 overflow-auto max-h-96 bg-white p-4 rounded border border-gray-200">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

// P&ID View Component
const PIDView = ({ data, onRegenerate, onDownload, onDownloadDrawing }) => {
  const confidenceColor = data.confidence_score >= 80 ? 'text-green-600' : 
                          data.confidence_score >= 60 ? 'text-yellow-600' : 'text-red-600';
  
  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-2xl font-bold mb-2">✓ P&ID Successfully Generated!</h3>
            <p className="text-green-100 mb-4">
              AI has analyzed the PFD and generated comprehensive P&ID specifications with visual drawing
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <div className="text-sm text-green-100">Drawing Number</div>
                <div className="font-semibold">{data.pid_drawing_number}</div>
              </div>
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <div className="text-sm text-green-100">Confidence Score</div>
                <div className="font-semibold">{data.confidence_score}%</div>
              </div>
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <div className="text-sm text-green-100">Status</div>
                <div className="font-semibold capitalize">{data.status}</div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={onDownloadDrawing}
              className="px-4 py-2 bg-white text-green-600 rounded-lg hover:bg-green-50 font-medium transition-colors flex items-center"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Download P&ID Drawing (PDF)
            </button>
            <button
              onClick={onDownload}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 font-medium transition-colors flex items-center"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Specifications (JSON)
            </button>
            <button
              onClick={onRegenerate}
              className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 font-medium transition-colors flex items-center"
            >
              <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerate
            </button>
          </div>
        </div>
      </div>

      {/* Equipment List */}
      {data.equipment_list && data.equipment_list.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="h-6 w-6 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Equipment List ({data.equipment_list.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Tag</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">Specifications</th>
                </tr>
              </thead>
              <tbody>
                {data.equipment_list.map((item, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-purple-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.tag || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{item.description || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs">
                        {item.equipment_type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {item.specifications ? JSON.stringify(item.specifications).substring(0, 50) + '...' : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instrumentation List */}
      {data.instrument_list && data.instrument_list.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="h-6 w-6 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Instrumentation ({data.instrument_list.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.instrument_list.map((item, index) => (
              <div key={index} className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">{item.tag || 'No Tag'}</span>
                  <span className="px-2 py-1 bg-blue-200 text-blue-800 text-xs rounded-full">
                    {item.instrument_type || 'N/A'}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{item.description || 'No description'}</p>
                {item.service_description && (
                  <p className="text-xs text-gray-600 mt-1">{item.service_description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Systems */}
      {data.safety_systems && data.safety_systems.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="h-6 w-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Safety Systems ({data.safety_systems.length})
          </h3>
          <div className="space-y-3">
            {data.safety_systems.map((item, index) => (
              <div key={index} className="bg-red-50 rounded-lg p-4 border border-red-200">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">{item.tag || 'Safety Device'}</span>
                  <span className="px-2 py-1 bg-red-200 text-red-800 text-xs rounded-full">
                    {item.device_type || 'Safety'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-2">{item.description || 'No description'}</p>
                {item.set_pressure && (
                  <p className="text-xs text-gray-600 mt-1">Set Pressure: {item.set_pressure}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compliance Checks */}
      {data.compliance_checks && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="h-6 w-6 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Compliance & Validation
          </h3>
          <div className="space-y-3">
            {Array.isArray(data.compliance_checks) ? (
              data.compliance_checks.map((item, index) => (
                <div key={index} className={`rounded-lg p-4 border ${
                  item.severity === 'critical' ? 'bg-red-50 border-red-200' :
                  item.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.check || 'Compliance Check'}</h4>
                      <p className="text-sm text-gray-700">{item.details || 'No details available'}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      item.severity === 'critical' ? 'bg-red-200 text-red-800' :
                      item.severity === 'warning' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-green-200 text-green-800'
                    }`}>
                      {item.severity || 'info'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              Object.entries(data.compliance_checks).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                  <span className={`font-medium ${
                    typeof value === 'boolean' ? (value ? 'text-green-600' : 'text-red-600') : 
                    typeof value === 'object' ? 'text-gray-900' : 'text-gray-900'
                  }`}>
                    {typeof value === 'boolean' ? (value ? '✓ Pass' : '✗ Fail') : 
                     typeof value === 'object' ? JSON.stringify(value) : value}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Raw JSON View */}
      <div>
        <details className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <summary className="cursor-pointer font-semibold text-gray-900 hover:text-purple-600">
            View Complete P&ID Specifications (JSON)
          </summary>
          <pre className="mt-4 text-xs text-gray-700 overflow-auto max-h-96 bg-white p-4 rounded border border-gray-200">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
};

export default PFDConvert;
