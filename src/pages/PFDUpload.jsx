import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api.service';
import UPLOAD_REQUIREMENTS, { areRequiredDocumentsUploaded, getUploadMode, validateFile as validateFileHelper } from '../config/uploadRequirements.config';

/**
 * PFD Upload Page
 * Upload Process Flow Diagrams for AI-powered conversion to P&ID
 * Philosophy document is now OPTIONAL (configurable in uploadRequirements.config.js)
 */
const PFDUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [philosophyFile, setPhilosophyFile] = useState(null);
  const [formData, setFormData] = useState({
    document_title: '',
    document_number: '',
    revision: '',
    project_name: '',
    project_code: ''
  });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [uploadMode, setUploadMode] = useState(null);

  const validateFile = (selectedFile, fileType = 'PFD') => {
    const validation = validateFileHelper(selectedFile);
    if (!validation.valid) {
      setError(`${fileType}: ${validation.error}`);
      return false;
    }
    return true;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && validateFile(selectedFile, 'PFD')) {
      setFile(selectedFile);
      setError('');
      // Update upload mode
      updateUploadMode({ pfd: selectedFile, philosophy: philosophyFile });
    }
  };

  const handlePhilosophyFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && validateFile(selectedFile, 'Philosophy')) {
      setPhilosophyFile(selectedFile);
      setError('');
      // Update upload mode
      updateUploadMode({ pfd: file, philosophy: selectedFile });
    }
  };

  const updateUploadMode = (docs) => {
    const mode = getUploadMode(docs);
    setUploadMode(mode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Soft-coded validation using configuration
    const uploadedDocs = { pfd: file, philosophy: philosophyFile };
    
    if (!file) {
      setError(UPLOAD_REQUIREMENTS.messages.pfdRequired);
      return;
    }

    // Check if all REQUIRED documents are uploaded (philosophy is now optional)
    if (!areRequiredDocumentsUploaded(uploadedDocs)) {
      setError('Please upload all required documents');
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const uploadData = new FormData();
      uploadData.append('file', file);
      
      // Only append philosophy file if uploaded (optional)
      if (philosophyFile) {
        uploadData.append('philosophy_file', philosophyFile);
      }
      
      // Add metadata if provided
      if (formData.document_title) uploadData.append('document_title', formData.document_title);
      if (formData.document_number) uploadData.append('document_number', formData.document_number);
      if (formData.revision) uploadData.append('revision', formData.revision);
      if (formData.project_name) uploadData.append('project_name', formData.project_name);
      if (formData.project_code) uploadData.append('project_code', formData.project_code);

      setProgress(30);

      const response = await apiClient.post('/pfd/documents/upload/', uploadData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgress(30 + (percentCompleted * 0.7)); // 30-100%
        },
      });

      setProgress(100);
      
      // Navigate to Phase 1: PFD Analysis Console
      setTimeout(() => {
        navigate(`/pfd/analyze/${response.data.id}`);
      }, 500);

    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || err.response?.data?.detail || 'Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl sm:max-w-3xl lg:max-w-4xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-purple-600 hover:text-purple-800 mb-4"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Upload PFD & Philosophy Documents
            </h1>
          </div>
          
          {/* RAG Information Banner */}
          <div className="bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-green-500 p-4 mb-6 rounded-r-lg shadow-sm">
            <div className="flex items-start">
              <svg className="h-6 w-6 text-green-600 mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-green-900 mb-1">
                  🤖 AI-Enhanced Analysis with RAG (Retrieval Augmented Generation)
                </h3>
                <p className="text-xs text-green-800 leading-relaxed">
                  Your PFD will be analyzed using intelligent context retrieval. The system automatically searches 
                  for similar reference PFDs from your S3 bucket (<span className="font-mono font-semibold">rejlers-engineering-data</span>) 
                  and uses them as context to provide more accurate analysis based on your organization's historical project data.
                </p>
              </div>
            </div>
          </div>
          
          {/* Upload Mode Notice - Dynamic based on uploaded files */}
          {uploadMode && (
              <div className={`border-l-4 p-4 mb-6 ${
                uploadMode.requiredDocs.includes('philosophy') 
                  ? 'bg-blue-50 border-blue-500' 
                  : 'bg-green-50 border-green-500'
              }`}>
                <div className="flex items-start">
                  <svg className={`h-5 w-5 mr-3 mt-0.5 ${
                    uploadMode.requiredDocs.includes('philosophy') ? 'text-blue-500' : 'text-green-500'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold mb-2 ${
                      uploadMode.requiredDocs.includes('philosophy') ? 'text-blue-800' : 'text-green-800'
                    }`}>
                      {uploadMode.description}
                    </p>
                    <p className={`text-xs mb-2 ${
                      uploadMode.requiredDocs.includes('philosophy') ? 'text-blue-700' : 'text-green-700'
                    }`}>
                      Estimated processing: {uploadMode.processingTime}
                    </p>
                    <ul className={`text-xs space-y-1 ${
                      uploadMode.requiredDocs.includes('philosophy') ? 'text-blue-600' : 'text-green-600'
                    }`}>
                      {uploadMode.features.map((feature, idx) => (
                        <li key={idx}>• {feature}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {!uploadMode && (
              <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-purple-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-purple-800 mb-1">
                      PFD Document is required - Philosophy is optional
                    </p>
                    <p className="text-xs text-purple-700">
                      Upload philosophy document for enhanced P&ID with control logic integration
                    </p>
                  </div>
                </div>
              </div>
            )}
          
          <p className="text-gray-600">AI-powered conversion from PFD to detailed P&ID drawings with philosophy integration</p>
        </div>

        <div className="flex items-center my-8">
          <div className="flex-1 border-t-2 border-gray-300"></div>
          <span className="px-4 text-gray-500 font-medium">OR</span>
          <div className="flex-1 border-t-2 border-gray-300"></div>
        </div>

        {/* Main Upload Card */}
        <div className="bg-white rounded-xl shadow-2xl p-8 border-2 border-purple-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Required Documents Notice */}
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-purple-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-medium text-purple-800">
                  Both PFD and Philosophy documents are required to start processing
                </p>
              </div>
            </div>

            {/* File Upload Areas - Side by side on larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PFD Document Upload */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-4">
                  PFD Document <span className="text-red-500">*</span>
                </label>
                
                <div className="border-4 border-dashed border-purple-200 rounded-xl p-6 text-center hover:border-purple-400 transition-colors">
                  <input
                    type="file"
                    id="pfd-file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                  
                  <label htmlFor="pfd-file" className="cursor-pointer">
                    {file ? (
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-purple-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm font-medium text-gray-900 break-all">{file.name}</p>
                        <p className="text-xs text-gray-500 mt-2">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setFile(null);
                          }}
                          className="mt-3 text-xs text-purple-600 hover:text-purple-800"
                        >
                          Change file
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          Upload PFD
                        </p>
                        <p className="text-xs text-gray-500">
                          PDF, JPEG, PNG (max 10MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Philosophy Document Upload */}
              <div>
                <label className="block text-lg font-semibold text-gray-900 mb-4">
                  Philosophy Document <span className="text-red-500">*</span>
                </label>
                
                <div className="border-4 border-dashed border-blue-200 rounded-xl p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    id="philosophy-file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handlePhilosophyFileChange}
                    className="hidden"
                    disabled={uploading}
                  />
                  
                  <label htmlFor="philosophy-file" className="cursor-pointer">
                    {philosophyFile ? (
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-blue-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <p className="text-sm font-medium text-gray-900 break-all">{philosophyFile.name}</p>
                        <p className="text-xs text-gray-500 mt-2">{(philosophyFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setPhilosophyFile(null);
                          }}
                          className="mt-3 text-xs text-blue-600 hover:text-blue-800"
                        >
                          Change file
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          Upload Philosophy
                        </p>
                        <p className="text-xs text-gray-500">
                          PDF, JPEG, PNG (max 10MB)
                        </p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Document Metadata */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Document Information (Optional)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={formData.document_title}
                    onChange={(e) => setFormData({ ...formData, document_title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="e.g., Crude Oil Processing Unit"
                    disabled={uploading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Number
                  </label>
                  <input
                    type="text"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="e.g., PFD-001"
                    disabled={uploading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Revision
                  </label>
                  <input
                    type="text"
                    value={formData.revision}
                    onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="e.g., A, B, C"
                    disabled={uploading}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={formData.project_name}
                    onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="e.g., ADNOC Refinery Expansion"
                    disabled={uploading}
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Code
                  </label>
                  <input
                    type="text"
                    value={formData.project_code}
                    onChange={(e) => setFormData({ ...formData, project_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900"
                    placeholder="e.g., ADNOC-REF-2024"
                    disabled={uploading}
                  />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            {uploading && (
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Uploading and processing...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!file || uploading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed font-medium transition-all shadow-lg"
              >
                {uploading ? 'Processing...' : !file ? 'Upload PFD to Continue' : philosophyFile ? 'Upload & Process (PFD + Philosophy)' : 'Upload & Process (PFD Only)'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-3">
              <svg className="h-8 w-8 text-purple-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <h3 className="font-semibold text-gray-900">AI Processing</h3>
            </div>
            <p className="text-sm text-gray-600">
              Advanced AI extracts process equipment, flows, and parameters from your PFD
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-3">
              <svg className="h-8 w-8 text-purple-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <h3 className="font-semibold text-gray-900">Smart Conversion</h3>
            </div>
            <p className="text-sm text-gray-600">
              Automatically generates instrumentation, piping specs, and safety systems
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center mb-3">
              <svg className="h-8 w-8 text-purple-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="font-semibold text-gray-900">Standards Compliant</h3>
            </div>
            <p className="text-sm text-gray-600">
              Ensures compliance with ADNOC DEP, API, and ISA standards
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PFDUpload;

