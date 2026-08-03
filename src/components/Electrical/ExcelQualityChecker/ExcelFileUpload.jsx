import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CloudArrowUpIcon, 
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';

/**
 * Excel File Upload Component
 * Drag-and-drop or file input for Excel datasheet uploads
 * Shows upload progress and validation results
 */
const ExcelFileUpload = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please upload an Excel file (.xlsx)');
      }
    }
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please upload an Excel file (.xlsx)');
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await apiClient.post(
        '/electrical-datasheet/excel/excel-documents/upload/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(progress);
          },
        }
      );

      setUploadResult(response.data);
      setUploading(false);

      // Navigate to document detail page after a short delay
      setTimeout(() => {
        if (response.data.document && response.data.document.id) {
          navigate(`/engineering/electrical/datasheet/quality-checker/${response.data.document.id}`);
        }
      }, 1500);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-amber-600 px-6 py-4">
          <div className="flex items-center space-x-3">
            <DocumentCheckIcon className="h-8 w-8 text-white" />
            <div>
              <h2 className="text-2xl font-bold text-white">
                Excel Datasheet Quality Checker
              </h2>
              <p className="text-yellow-50 text-sm mt-1">
                Upload electrical technical datasheets for automated validation
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {!uploadResult ? (
            <>
              {/* Upload Area */}
              <div
                className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                  isDragging
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <CloudArrowUpIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-700">
                    {selectedFile ? selectedFile.name : 'Drop your Excel file here'}
                  </p>
                  <p className="text-sm text-gray-500">or</p>
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 cursor-pointer transition-colors"
                  >
                    Browse Files
                    <input
                      id="file-upload"
                      type="file"
                      className="sr-only"
                      accept=".xlsx"
                      onChange={handleFileSelect}
                      disabled={uploading}
                    />
                  </label>
                </div>

                <p className="mt-4 text-xs text-gray-500">
                  Supported files: .xlsx (Excel 2007+) • Max size: 50 MB
                </p>
              </div>

              {/* Supported Equipment Types */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  Supported Equipment Types:
                </h3>
                <ul className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                  <li>• LV Variable Frequency Drive / Static AC UPS System</li>
                  <li>• LV Power / Control / Earthing Cables</li>
                  <li>• Neutral Earthing Resistor (NER)</li>
                  <li>• Motors, Transformers, Switchgear</li>
                </ul>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
                    <div>
                      <h4 className="text-sm font-medium text-red-800">Upload Error</h4>
                      <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div className="mt-6 flex justify-end space-x-3">
                {selectedFile && (
                  <button
                    type="button"
                    onClick={resetUpload}
                    disabled={uploading}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload & Validate'}
                </button>
              </div>

              {/* Upload Progress */}
              {uploading && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {uploadProgress < 100 ? 'Uploading...' : 'Processing...'}
                    </span>
                    <span className="text-sm text-gray-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  {uploadProgress === 100 && (
                    <p className="mt-2 text-sm text-gray-600 text-center">
                      Parsing and validating datasheet...
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            /* Upload Success */
            <div className="text-center py-8">
              <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Upload Successful!
              </h3>
              <p className="text-gray-600 mb-4">
                Your datasheet has been validated
              </p>
              
              {uploadResult.document && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6 max-w-md mx-auto">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-left">
                      <span className="text-gray-500">Equipment Type:</span>
                      <p className="font-medium text-gray-900">
                        {uploadResult.document.equipment_type_display}
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="text-gray-500">Validation Score:</span>
                      <p className="font-medium text-gray-900">
                        {uploadResult.document.validation_score || 'N/A'}%
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="text-gray-500">Errors:</span>
                      <p className="font-medium text-red-600">
                        {uploadResult.document.error_count}
                      </p>
                    </div>
                    <div className="text-left">
                      <span className="text-gray-500">Warnings:</span>
                      <p className="font-medium text-yellow-600">
                        {uploadResult.document.warning_count}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={resetUpload}
                className="px-6 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 transition-colors"
              >
                Upload Another File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelFileUpload;
