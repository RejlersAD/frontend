/**
 * CRS PDF Processor Component
 * Add this to your existing CRSDocuments.jsx page
 * 
 * This component provides UI for:
 * 1. Uploading ConsolidatedComments PDF
 * 2. Processing and extracting comments
 * 3. Downloading populated CRS template
 */

import React, { useState } from 'react';
import { API_BASE_URL } from '../config/api.config';

const CRSPDFProcessor = ({ document }) => {
  const [pdfFile, setPdfFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const API_URL = API_BASE_URL.replace('/api/v1', '');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setResult(null);
    } else {
      alert('Please select a valid PDF file');
    }
  };

  const processAndDownload = async () => {
    if (!pdfFile) {
      alert('Please select a PDF file first');
      return;
    }

    setProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('pdf_file', pdfFile);
      formData.append('metadata', JSON.stringify({
        project_name: document.project_name || 'N/A',
        document_number: document.document_number || 'N/A',
        revision: document.version || '1.0',
      }));

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/v1/crs-documents/${document.id}/process-pdf-comments/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Processing failed');
      }

      // Get comment count from headers
      const commentCount = response.headers.get('X-Comment-Count') || 'unknown';

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CRS_Populated_${document.document_number || 'document'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setResult({
        success: true,
        commentCount: commentCount,
        message: `Successfully extracted ${commentCount} comments and populated CRS template`
      });

      // Clear file after success
      setPdfFile(null);
      
    } catch (error) {
      console.error('Error:', error);
      setResult({
        success: false,
        message: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  const extractCommentsOnly = async () => {
    if (!pdfFile) {
      alert('Please select a PDF file first');
      return;
    }

    setProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('pdf_file', pdfFile);

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/v1/crs-documents/${document.id}/extract-comments-only/`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Extraction failed');
      }

      const data = await response.json();
      
      setResult({
        success: true,
        comments: data.comments,
        statistics: data.statistics,
        message: data.message
      });

    } catch (error) {
      console.error('Error:', error);
      setResult({
        success: false,
        message: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-xl font-bold text-gray-900">
            📋 CRS Document Intelligence
          </h3>
          <p className="text-sm text-gray-600">
            Extract comments from PDF and populate CRS template
          </p>
        </div>
      </div>

      {/* File Upload */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Upload ConsolidatedComments PDF
        </label>
        <div className="relative">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-3 file:px-6
              file:rounded-xl file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100
              transition-all cursor-pointer"
          />
        </div>
        {pdfFile && (
          <p className="mt-2 text-sm text-green-600 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Selected: {pdfFile.name}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={processAndDownload}
          disabled={!pdfFile || processing}
          className={`px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            !pdfFile || processing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:scale-105'
          }`}
        >
          {processing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Process & Download CRS
            </>
          )}
        </button>

        <button
          onClick={extractCommentsOnly}
          disabled={!pdfFile || processing}
          className={`px-6 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
            !pdfFile || processing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-blue-500 hover:shadow-md'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Preview Comments Only
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className={`p-4 rounded-xl border-2 ${
          result.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
              result.success ? 'bg-green-500' : 'bg-red-500'
            }`}>
              {result.success ? (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className={`font-semibold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                {result.success ? '✅ Success!' : '❌ Error'}
              </p>
              <p className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.message}
              </p>
              
              {result.statistics && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-xs text-gray-600">Total Comments</div>
                    <div className="text-lg font-bold text-gray-900">{result.statistics.total}</div>
                  </div>
                  <div className="bg-white rounded-lg p-2">
                    <div className="text-xs text-gray-600">Pages</div>
                    <div className="text-lg font-bold text-gray-900">{result.statistics.pages_with_comments}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-900">
            <p className="font-semibold mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Upload your ConsolidatedComments PDF</li>
              <li>System extracts reviewer comments automatically</li>
              <li>CRS template is populated with extracted data</li>
              <li>Download ready-to-use Excel file (format preserved)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRSPDFProcessor;

/*
USAGE IN CRSDocuments.jsx:

import CRSPDFProcessor from './components/CRSPDFProcessor';

// In your component:
<CRSPDFProcessor document={selectedDocument} />

// Or add as a modal/section when viewing a document
*/
