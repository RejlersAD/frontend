/**
 * Modern Process Datasheet Upload Page
 * Redesigned with better UX and error handling
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  ArrowLeft,
  Loader
} from 'lucide-react';
import apiClient from '../../services/api.service';

const DatasheetUpload = () => {
  const navigate = useNavigate();
  
  // State
  const [step, setStep] = useState(1); // 1: Select Type, 2: Upload File
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load equipment types
  useEffect(() => {
    loadEquipmentTypes();
  }, []);

  const loadEquipmentTypes = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/process-datasheet/equipment-types/');
      const data = Array.isArray(response.data) ? response.data : response.data.results || [];
      setEquipmentTypes(data);
    } catch (err) {
      console.error('Error loading equipment types:', err);
      setError('Failed to load equipment types. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // Equipment type selection
  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setStep(2);
    setError(null);
  };

  // File handling
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please select a PDF file');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please drop a PDF file');
    }
  };

  // Upload handler
  const handleUpload = async () => {
    if (!file || !selectedType) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('pdf_file', file);
      formData.append('equipment_type', selectedType.id);

      const response = await apiClient.post(
        '/process-datasheet/datasheets/extract/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setProgress(percent);
          },
        }
      );

      if (response.data) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/engineering/process/datasheet/dashboard');
        }, 2000);
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading equipment types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Upload Process Datasheet
            </h1>
            <button
              onClick={() => navigate('/engineering/process/datasheet/dashboard')}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>
          <p className="text-gray-600">
            Upload a PDF datasheet and extract data automatically using AI
          </p>

          {/* Progress Steps */}
          <div className="flex items-center gap-4 mt-6">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 1 ? 'bg-indigo-600 text-white' : 'bg-gray-200'
              }`}>
                1
              </div>
              <span className="font-medium">Select Type</span>
            </div>
            <div className="flex-1 h-1 bg-gray-200 rounded">
              <div 
                className={`h-full rounded transition-all duration-300 ${
                  step >= 2 ? 'bg-indigo-600 w-full' : 'w-0'
                }`}
              />
            </div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step >= 2 ? 'bg-indigo-600 text-white' : 'bg-gray-200'
              }`}>
                2
              </div>
              <span className="font-medium">Upload File</span>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900">Success!</h3>
              <p className="text-green-700">Datasheet uploaded and extracted successfully. Redirecting...</p>
            </div>
          </div>
        )}

        {/* Step 1: Equipment Type Selection */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Equipment Type</h2>
            
            {equipmentTypes.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No equipment types configured.</p>
                <p className="text-gray-500 text-sm mt-2">Please contact your administrator.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {equipmentTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type)}
                    className="bg-gradient-to-br from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 border-2 border-indigo-200 hover:border-indigo-400 rounded-xl p-6 text-left transition-all duration-200 transform hover:scale-105"
                  >
                    <FileText className="w-10 h-10 text-indigo-600 mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {type.name}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {type.description || 'No description available'}
                    </p>
                    <div className="mt-3 text-xs text-indigo-600 font-medium">
                      {type.field_count || 0} fields configured
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: File Upload */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {/* Selected Type Info */}
            <div className="bg-indigo-50 rounded-xl p-4 mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-indigo-600" />
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedType?.name}</h3>
                  <p className="text-sm text-gray-600">{selectedType?.description}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setSelectedType(null);
                }}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                Change
              </button>
            </div>

            {/* Upload Area */}
            <div
              className={`border-3 border-dashed rounded-2xl p-12 text-center transition-all ${
                dragging
                  ? 'border-indigo-500 bg-indigo-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />

              {!file ? (
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Drop PDF file here or click to browse
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Maximum file size: 50MB
                  </p>
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                    <Upload className="w-5 h-5" />
                    Select File
                  </div>
                </label>
              ) : (
                <div>
                  <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {file.name}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  {!uploading && (
                    <button
                      onClick={() => setFile(null)}
                      className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Uploading...</span>
                  <span className="text-sm font-medium text-indigo-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-blue-500 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Extracting data from PDF using AI...
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {!uploading && file && (
              <div className="flex gap-4 mt-8">
                <button
                  onClick={() => {
                    setFile(null);
                    setStep(1);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Upload & Extract
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DatasheetUpload;
