import React, { useState } from 'react';
import {
  CloudArrowUpIcon,
  DocumentIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

const FileUploadSection = ({ 
  onFileUpload, 
  existingFiles = [], 
  onFileRemove,
  onFileDownload,
  acceptedTypes = '.pdf,.xlsx,.xls',
  maxSize = 10 * 1024 * 1024, // 10MB
  showADNOCValidation = true
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const validateFile = (file) => {
    // Check file size
    if (file.size > maxSize) {
      return `File size exceeds ${(maxSize / 1024 / 1024).toFixed(0)}MB limit`;
    }

    // Check file type
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const acceptedTypesArray = acceptedTypes.split(',').map(t => t.trim());
    
    if (!acceptedTypesArray.includes(fileExtension)) {
      return `File type ${fileExtension} not supported. Accepted types: ${acceptedTypes}`;
    }

    return null;
  };

  const handleFile = async (file) => {
    setUploadError(null);

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      await onFileUpload(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Reset after success
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 1500);
    } catch (error) {
      setUploadError(error.message || 'Upload failed');
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      return '📄';
    } else if (ext === 'xlsx' || ext === 'xls') {
      return '📊';
    }
    return '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-all
          ${dragActive ? 'border-purple-500 bg-purple-50' : 'border-gray-300 hover:border-purple-400'}
          ${uploading ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          className="hidden"
          accept={acceptedTypes}
          onChange={handleChange}
          disabled={uploading}
        />

        <label
          htmlFor="file-upload"
          className="flex flex-col items-center justify-center cursor-pointer"
        >
          <CloudArrowUpIcon className="w-12 h-12 text-purple-500 mb-3" />
          
          <p className="text-sm font-medium text-gray-700 mb-1">
            Click to upload or drag and drop
          </p>
          
          <p className="text-xs text-gray-500">
            {acceptedTypes.split(',').join(', ').toUpperCase()} up to {(maxSize / 1024 / 1024).toFixed(0)}MB
          </p>

          {showADNOCValidation && (
            <div className="mt-3 px-3 py-1.5 bg-purple-100 rounded-full">
              <p className="text-xs font-medium text-purple-700">
                ✨ Automatic ADNOC Standards Validation
              </p>
            </div>
          )}
        </label>

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Upload Error</p>
            <p className="text-xs text-red-600 mt-1">{uploadError}</p>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-red-400 hover:text-red-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Existing Files List */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Attached Files ({existingFiles.length})
          </h4>
          
          {existingFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-2xl flex-shrink-0">
                  {getFileIcon(file.file_name)}
                </span>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.file_name}
                  </p>
                  
                  <div className="flex items-center space-x-3 mt-1">
                    {file.file_type && (
                      <span className="text-xs text-gray-500 capitalize">
                        {file.file_type.replace('_', ' ')}
                      </span>
                    )}
                    
                    {file.file_size && (
                      <span className="text-xs text-gray-500">
                        {formatFileSize(file.file_size)}
                      </span>
                    )}
                    
                    {file.uploaded_at && (
                      <span className="text-xs text-gray-500">
                        {new Date(file.uploaded_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {file.validation_status && (
                  <div className="flex-shrink-0">
                    {file.validation_status === 'passed' ? (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">Validated</span>
                      </div>
                    ) : file.validation_status === 'failed' ? (
                      <div className="flex items-center space-x-1 text-red-600">
                        <ExclamationCircleIcon className="w-4 h-4" />
                        <span className="text-xs font-medium">Issues Found</span>
                      </div>
                    ) : (
                      <span className="text-xs text-yellow-600 font-medium">Pending</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 ml-4">
                {onFileDownload && (
                  <button
                    onClick={() => onFileDownload(file, index)}
                    className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                    title="Download file"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                  </button>
                )}
                
                {onFileRemove && (
                  <button
                    onClick={() => onFileRemove(file, index)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove file"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Banner */}
      {showADNOCValidation && existingFiles.length === 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <DocumentIcon className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-purple-900 mb-1">
                ADNOC Standards Validation
              </h4>
              <p className="text-xs text-purple-700 leading-relaxed">
                Uploaded datasheets will be automatically validated against ADNOC engineering standards 
                including IEC 60076 (transformers) and IEC 62271 (switchgear). The system will check 
                voltage ratings, power ratings, impedance, cooling types, and other critical parameters.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadSection;
