import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ExclamationTriangleIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { STORAGE_KEYS } from '../../../config/app.config';
import { apiClientLongTimeout } from '../../../services/api.service';
import * as XLSX from 'xlsx';

const CriticalStressLineList = () => {
  const navigate = useNavigate();
  const fileInputOnshoreRef = useRef(null);
  const fileInputGeneralRef = useRef(null);
  const fileInputOffshoreRef = useRef(null);
  
  const [uploadingPID, setUploadingPID] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  
  // CRITICAL STRESS COLUMN CONFIGURATION - Soft coded for easy maintenance
  const CRITICAL_STRESS_COLUMNS = [
    { key: 'line_number', label: 'Line Number', altKeys: ['item_tag'], show: true },
    { key: 'from_line', label: 'From', altKeys: ['from'], show: true },
    { key: 'to_line', label: 'To', altKeys: ['to'], show: true },
    { key: 'size', label: 'Size', altKeys: ['line_size'], show: true },
    { key: 'temperature', label: 'Temperature', altKeys: [], show: true, empty: true },
    { key: 'critical_stress', label: 'Critical Stress', altKeys: [], show: true, empty: true },
    { key: 'spec', label: 'Spec', altKeys: [], show: true }
  ];
  
  // Line Number Format Configuration (same as Line List)
  const STRICT_LINE_PATTERNS = {
    line_size: '\\d{1,2}',
    area: '\\d{2,3}',
    fluid_code: '[A-Z]{1,3}',
    sequence_no: '\\d{3,5}',
    pipe_class: '[A-Z0-9]{3,6}',
    insulation: '[A-Z]{1,2}'
  };
  
  const [lineNumberFormat] = useState({
    components: [
      { id: 'line_size', name: 'Line Size', enabled: true, order: 1, pattern: '\\d{1,2}', example: '36' },
      { id: 'area', name: 'Area', enabled: false, order: 2, pattern: '\\d{2,3}', example: '41' },
      { id: 'fluid_code', name: 'Fluid Code', enabled: true, order: 3, pattern: '[A-Z]{1,3}', example: 'SWR' },
      { id: 'sequence_no', name: 'Sequence No', enabled: true, order: 4, pattern: '\\d{3,5}', example: '60302' },
      { id: 'pipe_class', name: 'Pipe Class', enabled: true, order: 5, pattern: '[A-Z0-9]{3,6}', example: 'A2AU16' },
      { id: 'insulation', name: 'Insulation', enabled: false, order: 6, pattern: '[A-Z]{1,2}', example: 'V' }
    ],
    separator: '-',
    allowVariableSeparators: true
  });

  // EXACT SAME UPLOAD LOGIC AS LINE LIST - just change list_type to 'critical_stress'
  const handlePIDUpload = async (event, includeArea = false, formatType = 'onshore') => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadResult({
        success: false,
        message: 'Please upload a PDF file'
      });
      return;
    }

    setUploadingPID(true);
    setProcessing(true);
    setUploadResult(null);
    
    try {
      const formData = new FormData();
      formData.append('pid_file', file);
      formData.append('list_type', 'critical_stress'); // ← ONLY DIFFERENCE FROM LINE LIST
      formData.append('include_area', includeArea ? 'true' : 'false');
      formData.append('format_type', formatType);
      
      // Add line number format configuration
      const enabledComponents = lineNumberFormat.components
        .filter(c => c.enabled)
        .sort((a, b) => a.order - b.order);
      
      formData.append('line_format_config', JSON.stringify({
        components: enabledComponents.map(c => ({
          id: c.id,
          name: c.name,
          order: c.order,
          pattern: STRICT_LINE_PATTERNS[c.id] || c.pattern
        })),
        separator: lineNumberFormat.separator,
        allowVariableSeparators: lineNumberFormat.allowVariableSeparators
      }));

      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      
      if (!token) {
        setUploadResult({
          success: false,
          message: 'Authentication token not found. Please log in again.'
        });
        return;
      }

      console.log('[Critical Stress Upload] 🚀 Starting upload with extended timeout (10 minutes)...');
      console.log('[Critical Stress Upload] File:', file.name, 'Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

      // Use long timeout client for OCR processing (10 minutes)
      const response = await apiClientLongTimeout.post(
        '/designiq/lists/upload_pid/',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`
            // Content-Type will be set automatically by axios for FormData
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log('[Critical Stress Upload] 📤 Upload progress:', percentCompleted + '%');
          }
        }
      );

      console.log('[Critical Stress Upload] ✅ Processing complete');
      
      const data = response.data;
      setExtractedData({
        lines: data.extracted_lines || [],
        fileName: file.name,
        itemsCreated: data.items_created || 0
      });
      setShowPreviewModal(true);
      setUploadResult({
        success: true,
        message: `Successfully uploaded document ${data.document_id || file.name} with ${data.extracted_lines?.length || 0} line items`,
        data: data
      });
      setUploadingPID(false);
    } catch (error) {
      console.error('[Critical Stress Upload] ❌ Error:', error);
      
      let errorMessage = 'Failed to upload P&ID';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Upload timed out. The PDF might be too large or complex. Please try a smaller file or contact support.';
      } else if (error.response) {
        // Server responded with error
        const errorData = error.response.data;
        errorMessage = errorData.detail || errorData.error || error.response.statusText || errorMessage;
      } else if (error.request) {
        // Request made but no response
        errorMessage = 'No response from server. Please check your connection and try again.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      setUploadResult({
        success: false,
        message: errorMessage
      });
    } finally {
      setProcessing(false);
      setUploadingPID(false);
      event.target.value = '';
    }
  };

  const handleExportExcel = () => {
    if (!extractedData || !extractedData.lines || extractedData.lines.length === 0) {
      alert('No data to export');
      return;
    }

    // Prepare data for Excel export using CRITICAL_STRESS_COLUMNS configuration
    const exportData = extractedData.lines.map(line => {
      const row = {};
      
      CRITICAL_STRESS_COLUMNS.filter(col => col.show).forEach(col => {
        if (col.empty) {
          // Empty column - leave blank
          row[col.label] = '';
        } else {
          // Try primary key, then alternative keys, then default to empty
          let value = line[col.key];
          if (!value && col.altKeys && col.altKeys.length > 0) {
            for (const altKey of col.altKeys) {
              if (line[altKey]) {
                value = line[altKey];
                break;
              }
            }
          }
          row[col.label] = value || '';
        }
      });
      
      return row;
    });

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Critical Stress Lines');
    
    // Generate filename
    const fileName = extractedData.fileName 
      ? `${extractedData.fileName.replace('.pdf', '')}_critical_stress.xlsx`
      : `critical_stress_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Download
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => navigate('/engineering/piping/datasheet')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to Data Sheets
        </button>
        
        <div className="flex items-center gap-3">
          <ExclamationTriangleIcon className="w-8 h-8 text-orange-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Critical Stress Line List</h1>
            <p className="text-gray-600 mt-1">Upload P&ID to extract stress critical piping line specifications</p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload P&ID Document</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ADNOC Onshore */}
            <div className="border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
              <h3 className="font-medium text-blue-700 mb-2">ADNOC Onshore Format</h3>
              <p className="text-sm text-gray-600 mb-4">Standard onshore piping format</p>
              <input
                ref={fileInputOnshoreRef}
                type="file"
                accept=".pdf"
                onChange={(e) => handlePIDUpload(e, false, 'onshore')}
                className="hidden"
              />
              <button
                onClick={() => fileInputOnshoreRef.current?.click()}
                disabled={uploadingPID}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
                {uploadingPID ? 'Processing...' : 'Upload PDF'}
              </button>
            </div>

            {/* General Format (with Area) */}
            <div className="border-2 border-green-200 rounded-lg p-4 hover:border-green-400 transition-colors">
              <h3 className="font-medium text-green-700 mb-2">General Format</h3>
              <p className="text-sm text-gray-600 mb-4">Includes area code in line number</p>
              <input
                ref={fileInputGeneralRef}
                type="file"
                accept=".pdf"
                onChange={(e) => handlePIDUpload(e, true, 'general')}
                className="hidden"
              />
              <button
                onClick={() => fileInputGeneralRef.current?.click()}
                disabled={uploadingPID}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
                {uploadingPID ? 'Processing...' : 'Upload PDF'}
              </button>
            </div>

            {/* ADNOC Offshore */}
            <div className="border-2 border-purple-200 rounded-lg p-4 hover:border-purple-400 transition-colors">
              <h3 className="font-medium text-purple-700 mb-2">ADNOC Offshore Format</h3>
              <p className="text-sm text-gray-600 mb-4">Offshore platform piping format</p>
              <input
                ref={fileInputOffshoreRef}
                type="file"
                accept=".pdf"
                onChange={(e) => handlePIDUpload(e, false, 'offshore')}
                className="hidden"
              />
              <button
                onClick={() => fileInputOffshoreRef.current?.click()}
                disabled={uploadingPID}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
                {uploadingPID ? 'Processing...' : 'Upload PDF'}
              </button>
            </div>
          </div>

          {/* Upload Status */}
          {uploadResult && (
            <div className={`mt-4 p-4 rounded-lg ${uploadResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <div className="flex items-center gap-2">
                {uploadResult.success ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-600" />
                )}
                <p className={uploadResult.success ? 'text-green-800' : 'text-red-800'}>
                  {uploadResult.message}
                </p>
              </div>
            </div>
          )}

          {/* Processing Indicator */}
          {processing && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <div>
                  <p className="text-blue-800 font-medium">Processing P&ID...</p>
                  <p className="text-blue-600 text-sm">This may take 4-5 minutes. OCR is extracting line numbers and FROM-TO connections.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview Modal */}
        {showPreviewModal && extractedData && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Extracted Critical Stress Lines</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {extractedData.fileName} • {extractedData.lines.length} lines extracted
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Export Excel
                  </button>
                  <button
                    onClick={() => setShowPreviewModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Modal Body - Table */}
              <div className="flex-1 overflow-auto p-6">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {CRITICAL_STRESS_COLUMNS.filter(col => col.show).map(col => (
                        <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {extractedData.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {CRITICAL_STRESS_COLUMNS.filter(col => col.show).map(col => {
                          // Handle empty columns
                          if (col.empty) {
                            return (
                              <td key={col.key} className="px-4 py-3 text-sm text-gray-400">
                                -
                              </td>
                            );
                          }
                          
                          // Get value from primary key or alternative keys
                          let value = line[col.key];
                          if (!value && col.altKeys && col.altKeys.length > 0) {
                            for (const altKey of col.altKeys) {
                              if (line[altKey]) {
                                value = line[altKey];
                                break;
                              }
                            }
                          }
                          
                          return (
                            <td key={col.key} className={`px-4 py-3 text-sm ${col.key === 'line_number' ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                              {value || '-'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CriticalStressLineList;
