/**
 * S3 PFD Browser Component
 * Browse and manage PFD/PID files from the existing S3 bucket structure
 * 
 * Bucket: rejlers-edrs-project
 * Structure:
 *   PFD_to_PID/
 *     PFD/  - Original PFD files
 *     PID/  - Converted P&ID files
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { API_BASE_URL } from '../config/api.config';

const S3PFDBrowser = () => {
  const { token } = useSelector((state) => state.auth);
  
  const [activeTab, setActiveTab] = useState('pfd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [pfdFiles, setPfdFiles] = useState([]);
  const [pidFiles, setPidFiles] = useState([]);
  const [bucketInfo, setBucketInfo] = useState(null);
  const [selectedPfd, setSelectedPfd] = useState(null);
  
  const [converting, setConverting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  
  // Fetch bucket info on mount
  useEffect(() => {
    fetchBucketInfo();
    fetchPFDFiles();
    fetchPIDFiles();
  }, []);
  
  const fetchBucketInfo = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/pfd/s3/bucket-info/`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setBucketInfo(response.data.bucket_info);
      }
    } catch (err) {
      console.error('Error fetching bucket info:', err);
    }
  };
  
  const fetchPFDFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/pfd/s3/pfd-files/`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setPfdFiles(response.data.files);
      }
    } catch (err) {
      console.error('Error fetching PFD files:', err);
      setError('Failed to load PFD files');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchPIDFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/pfd/s3/pid-files/`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        setPidFiles(response.data.files);
      }
    } catch (err) {
      console.error('Error fetching P&ID files:', err);
      setError('Failed to load P&ID files');
    } finally {
      setLoading(false);
    }
  };
  
  const downloadFile = async (s3Key, filename) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/pfd/s3/download/?key=${encodeURIComponent(s3Key)}`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
          responseType: 'blob',
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading file:', err);
      setError('Failed to download file');
    }
  };
  
  const convertPFDToPID = async (pfdKey) => {
    setConverting(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `${API_BASE_URL}/pfd/s3/convert/`,
        {
          pfd_key: pfdKey,
          output_format: 'pdf'
        },
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.data.success) {
        alert('Conversion completed successfully!');
        fetchPIDFiles();
        fetchPFDFiles(); // Refresh to update has_pid_conversion status
      } else {
        setError(response.data.error || 'Conversion failed');
      }
    } catch (err) {
      console.error('Error converting PFD:', err);
      setError(err.response?.data?.error || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };
  
  const uploadPFD = async (file) => {
    setUploadingFile(file.name);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('filename', file.name);
      formData.append('metadata', JSON.stringify({
        original_size: file.size,
        upload_date: new Date().toISOString()
      }));
      
      const response = await axios.post(
        `${API_BASE_URL}/pfd/s3/upload-pfd/`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success) {
        alert('PFD uploaded successfully!');
        fetchPFDFiles();
      } else {
        setError(response.data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Error uploading PFD:', err);
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingFile(null);
    }
  };
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      uploadPFD(file);
    }
  };
  
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🗂️ S3 PFD/P&ID Browser
        </h1>
        <p className="text-gray-600">
          Browse and manage files from AWS S3: rejlers-edrs-project
        </p>
        
        {/* Bucket Info */}
        {bucketInfo && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-semibold">Bucket:</span> {bucketInfo.bucket_name}
              </div>
              <div>
                <span className="font-semibold">Region:</span> {bucketInfo.region}
              </div>
              <div>
                <span className="font-semibold">PFD Files:</span> {bucketInfo.pfd_count}
              </div>
              <div>
                <span className="font-semibold">P&ID Files:</span> {bucketInfo.pid_count}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
          <button 
            onClick={() => setError(null)}
            className="float-right text-red-500 hover:text-red-700"
          >
            ✕
          </button>
        </div>
      )}
      
      {/* Upload Section */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          📤 Upload New PFD
        </h2>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-semibold
              file:bg-indigo-50 file:text-indigo-700
              hover:file:bg-indigo-100"
          />
          {uploadingFile && (
            <span className="text-sm text-gray-500">
              Uploading {uploadingFile}...
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-500">
          Supported formats: PDF, DWG, DXF, PNG, JPG
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-0">
        <button
          onClick={() => setActiveTab('pfd')}
          className={`px-6 py-3 font-medium rounded-t-lg ${
            activeTab === 'pfd'
              ? 'bg-white text-indigo-600 border-t border-l border-r border-gray-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📄 PFD Files ({pfdFiles.length})
        </button>
        <button
          onClick={() => setActiveTab('pid')}
          className={`px-6 py-3 font-medium rounded-t-lg ${
            activeTab === 'pid'
              ? 'bg-white text-indigo-600 border-t border-l border-r border-gray-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          📐 P&ID Files ({pidFiles.length})
        </button>
      </div>
      
      {/* Content */}
      <div className="bg-white rounded-b-lg rounded-tr-lg shadow-md p-6 border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-500">Loading...</span>
          </div>
        ) : (
          <>
            {/* PFD Files Tab */}
            {activeTab === 'pfd' && (
              <div>
                {pfdFiles.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            File Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Size
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Last Modified
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Status
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pfdFiles.map((file, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-2xl mr-3">📄</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {file.filename}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(file.last_modified)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {file.has_pid_conversion ? (
                                <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                                  ✓ Converted
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                                  Not Converted
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => downloadFile(file.s3_key, file.filename)}
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                              >
                                Download
                              </button>
                              {!file.has_pid_conversion && (
                                <button
                                  onClick={() => convertPFDToPID(file.s3_key)}
                                  disabled={converting}
                                  className="text-green-600 hover:text-green-900 disabled:opacity-50"
                                >
                                  {converting ? 'Converting...' : 'Convert to P&ID'}
                                </button>
                              )}
                              {file.has_pid_conversion && (
                                <button
                                  onClick={() => downloadFile(file.pid_key, file.filename.replace(/\.\w+$/, '_PID.pdf'))}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  View P&ID
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-4xl mb-4 block">📂</span>
                    <p>No PFD files found</p>
                    <p className="text-sm mt-2">Upload a PFD file to get started</p>
                  </div>
                )}
              </div>
            )}
            
            {/* P&ID Files Tab */}
            {activeTab === 'pid' && (
              <div>
                {pidFiles.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            File Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Size
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Last Modified
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Source PFD
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pidFiles.map((file, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-2xl mr-3">📐</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {file.filename}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(file.last_modified)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {file.has_pfd_source ? (
                                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                  ✓ Linked
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                                  No Source
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => downloadFile(file.s3_key, file.filename)}
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
                              >
                                Download
                              </button>
                              {file.has_pfd_source && (
                                <button
                                  onClick={() => downloadFile(file.pfd_key, file.pfd_key.split('/').pop())}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  View Source PFD
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <span className="text-4xl mb-4 block">📐</span>
                    <p>No P&ID files found</p>
                    <p className="text-sm mt-2">Convert a PFD to generate P&ID files</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default S3PFDBrowser;
