import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, Loader, X } from 'lucide-react';
import axios from 'axios';

const PFDVerification = () => {
  // Configuration for reference documents
  const referenceDocuments = [
    { key: 'bfd', label: 'BFD (Block Flow Diagram)', icon: FileText, color: 'blue', required: true },
    { key: 'process_description', label: 'PROCESS DESCRIPTION', icon: FileText, color: 'green', required: true },
    { key: 'process_design_basis', label: 'PROCESS DESIGN BASIS', icon: FileText, color: 'purple', required: true },
    { key: 'operation_control_philosophy', label: 'OPERATION & CONTROL PHILOSOPHY', icon: FileText, color: 'orange', required: true },
    { key: 'scope_of_work', label: 'SCOPE OF WORK', icon: FileText, color: 'indigo', required: true },
    { key: 'legends_symbols', label: 'LEGENDS AND SYMBOLS', icon: FileText, color: 'pink', required: true },
    { key: 'equipment_data_sheet', label: 'EQUIPMENT DATA SHEET', icon: FileText, color: 'teal', required: true },
    { key: 'other_documents', label: 'OTHER DOCUMENTS', icon: FileText, color: 'gray', required: false }
  ];

  // State management
  const [pfdFile, setPfdFile] = useState(null);
  const [referenceFiles, setReferenceFiles] = useState({});
  const [uploadProgress, setUploadProgress] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [projectName, setProjectName] = useState('');
  const [drawingNumber, setDrawingNumber] = useState('');
  const [revision, setRevision] = useState('');
  const [drawingTitle, setDrawingTitle] = useState('');

  // Handle PFD file selection
  const handlePfdFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'application/pdf') {
        if (file.size <= 50 * 1024 * 1024) {
          setPfdFile(file);
          setMessage({ type: 'success', text: `PFD file selected: ${file.name}` });
          setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } else {
          setMessage({ type: 'error', text: 'File size exceeds 50MB limit' });
          e.target.value = '';
        }
      } else {
        setMessage({ type: 'error', text: 'Please select a PDF file' });
        e.target.value = '';
      }
    }
  };

  // Handle reference document file selection
  const handleReferenceFileChange = (key, e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'application/pdf') {
        if (file.size <= 50 * 1024 * 1024) {
          setReferenceFiles(prev => ({ ...prev, [key]: file }));
          setMessage({ type: 'success', text: `Reference document selected: ${file.name}` });
          setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } else {
          setMessage({ type: 'error', text: 'File size exceeds 50MB limit' });
          e.target.value = '';
        }
      } else {
        setMessage({ type: 'error', text: 'Please select a PDF file' });
        e.target.value = '';
      }
    }
  };

  // Remove selected file
  const removeFile = (key) => {
    if (key === 'pfd') {
      setPfdFile(null);
      const input = document.getElementById('pfd-upload');
      if (input) input.value = '';
    } else {
      setReferenceFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[key];
        return newFiles;
      });
      const input = document.getElementById(`ref-${key}`);
      if (input) input.value = '';
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!pfdFile) {
      setMessage({ type: 'error', text: 'Please upload the PFD document' });
      return;
    }

    if (!projectName || !drawingNumber || !revision || !drawingTitle) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    // Check required reference documents
    const missingDocs = referenceDocuments
      .filter(doc => doc.required && !referenceFiles[doc.key])
      .map(doc => doc.label);
    
    if (missingDocs.length > 0) {
      setMessage({ type: 'error', text: `Please upload required documents: ${missingDocs.join(', ')}` });
      return;
    }

    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress({});

    try {
      const formData = new FormData();
      formData.append('pfd_file', pfdFile);
      formData.append('project_name', projectName);
      formData.append('drawing_number', drawingNumber);
      formData.append('revision', revision);
      formData.append('drawing_title', drawingTitle);
      formData.append('document_type', 'pfd');
      
      Object.keys(referenceFiles).forEach(key => {
        formData.append(`reference_${key}`, referenceFiles[key]);
      });

      const response = await axios.post(
        '/api/v1/designiq/pfd/upload/',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress({ overall: percentCompleted });
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        setUploadStatus('success');
        setMessage({ type: 'success', text: 'PFD uploaded successfully! Processing started...' });
        setTimeout(() => resetForm(), 3000);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to upload PFD. Please try again.'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setPfdFile(null);
    setReferenceFiles({});
    setUploadProgress({});
    setUploadStatus('idle');
    setMessage({ type: '', text: '' });
    setProjectName('');
    setDrawingNumber('');
    setRevision('');
    setDrawingTitle('');
    
    const pfdInput = document.getElementById('pfd-upload');
    if (pfdInput) pfdInput.value = '';
    
    referenceDocuments.forEach(doc => {
      const refInput = document.getElementById(`ref-${doc.key}`);
      if (refInput) refInput.value = '';
    });
  };

  // Get color class
  const getColorClass = (color) => {
    const colorMap = {
      blue: 'bg-blue-50 border-blue-200 text-blue-700',
      green: 'bg-green-50 border-green-200 text-green-700',
      purple: 'bg-purple-50 border-purple-200 text-purple-700',
      orange: 'bg-orange-50 border-orange-200 text-orange-700',
      indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
      pink: 'bg-pink-50 border-pink-200 text-pink-700',
      teal: 'bg-teal-50 border-teal-200 text-teal-700',
      gray: 'bg-gray-50 border-gray-200 text-gray-700'
    };
    return colorMap[color] || 'bg-gray-50 border-gray-200 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">PFD Design Verification</h1>
              <p className="text-gray-600 mt-1">
                Upload your PFD drawing for AI-powered engineering review and compliance verification
              </p>
            </div>
          </div>
        </div>

        {/* Inline Message */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' :
            message.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center space-x-2">
              {message.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
              {message.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
              <span className={`text-sm font-medium ${
                message.type === 'success' ? 'text-green-800' :
                message.type === 'error' ? 'text-red-800' :
                'text-blue-800'
              }`}>
                {message.text}
              </span>
            </div>
            <button onClick={() => setMessage({ type: '', text: '' })} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main PFD Upload Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Upload className="w-6 h-6 mr-2 text-blue-600" />
              PFD Drawing (PDF) *
            </h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                id="pfd-upload"
                accept=".pdf"
                onChange={handlePfdFileChange}
                className="hidden"
              />
              
              {!pfdFile ? (
                <label htmlFor="pfd-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <Upload className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-sm text-gray-500">PDF files only, up to 50MB</p>
                  </div>
                </label>
              ) : (
                <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{pfdFile.name}</p>
                      <p className="text-sm text-gray-500">{(pfdFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile('pfd')}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {/* Drawing Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Drawing Number *</label>
                <input
                  type="text"
                  value={drawingNumber}
                  onChange={(e) => setDrawingNumber(e.target.value)}
                  placeholder="e.g., 16-01-08-1678-1-1/1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Revision *</label>
                <input
                  type="text"
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  placeholder="e.g., Rev 01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Drawing Title *</label>
                <input
                  type="text"
                  value={drawingTitle}
                  onChange={(e) => setDrawingTitle(e.target.value)}
                  placeholder="e.g., Compressor Package"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Name *</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g., ADNOC Project XYZ"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Reference Documents Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <FileText className="w-6 h-6 mr-2 text-purple-600" />
              Reference Documents
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {referenceDocuments.map((doc) => (
                <div
                  key={doc.key}
                  className={`border-2 rounded-lg p-4 ${
                    referenceFiles[doc.key]
                      ? `${getColorClass(doc.color)} border-2`
                      : 'border-gray-200 hover:border-gray-300'
                  } transition-all`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <doc.icon className={`w-5 h-5 ${referenceFiles[doc.key] ? '' : 'text-gray-400'}`} />
                      <h3 className="font-medium text-sm">{doc.label}{doc.required ? ' *' : ''}</h3>
                    </div>
                  </div>

                  <input
                    type="file"
                    id={`ref-${doc.key}`}
                    accept=".pdf"
                    onChange={(e) => handleReferenceFileChange(doc.key, e)}
                    className="hidden"
                  />

                  {!referenceFiles[doc.key] ? (
                    <label
                      htmlFor={`ref-${doc.key}`}
                      className="block text-center py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors"
                    >
                      <p className="text-sm text-gray-600">Click to upload</p>
                      <p className="text-xs text-gray-400 mt-1">PDF up to 50MB</p>
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-white p-2 rounded">
                        <p className="text-xs font-medium truncate flex-1">{referenceFiles[doc.key].name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(doc.key)}
                        className="w-full text-xs text-red-600 hover:text-red-800 font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Reference Documents Help</p>
                  <p>Upload reference documents to enhance AI verification accuracy. These documents provide context for validation against design basis, operational philosophy, and equipment specifications.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center space-x-3 mb-4">
                <Loader className="w-6 h-6 text-blue-600 animate-spin" />
                <h3 className="text-lg font-semibold text-gray-900">Uploading PFD...</h3>
              </div>
              {uploadProgress.overall !== undefined && (
                <>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.overall}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{uploadProgress.overall}% complete</p>
                </>
              )}
            </div>
          )}

          {/* Status Messages */}
          {uploadStatus === 'success' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Upload Successful!</h3>
                  <p className="text-green-700 text-sm mt-1">Your PFD is being processed. You'll receive results soon.</p>
                </div>
              </div>
            </div>
          )}

          {uploadStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-900">Upload Failed</h3>
                  <p className="text-red-700 text-sm mt-1">Please check your files and try again.</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={resetForm}
              disabled={isUploading}
              className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Reset Form
            </button>
            <button
              type="submit"
              disabled={isUploading || !pfdFile}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
            >
              {isUploading ? (
                <span className="flex items-center space-x-2">
                  <Loader className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </span>
              ) : (
                'Upload PFD for Verification'
              )}
            </button>
          </div>
        </form>

        {/* Summary Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-6">
          <h3 className="font-semibold text-gray-900 mb-4">Upload Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">PFD Document</p>
              <p className="text-lg font-semibold text-blue-900">{pfdFile ? '✓ Ready' : '○ Required'}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Reference Documents</p>
              <p className="text-lg font-semibold text-purple-900">
                {Object.keys(referenceFiles).length} / {referenceDocuments.length}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Form Completion</p>
              <p className="text-lg font-semibold text-green-900">
                {pfdFile && projectName && drawingNumber && revision && drawingTitle ? '✓ Complete' : '○ In Progress'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PFDVerification;
