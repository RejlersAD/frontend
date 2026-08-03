import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';

/**
 * Excel Document Detail Page
 * Shows validation results, issues, and parsed data
 */
const ExcelDocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [issues, setIssues] = useState([]);
  const [parsedData, setParsedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');

  useEffect(() => {
    fetchDocumentDetails();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'issues') {
      fetchIssues();
    } else if (activeTab === 'parsed_data') {
      fetchParsedData();
    }
  }, [activeTab, filterSeverity, filterCategory, selectedSheet]);

  const fetchDocumentDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(
        `/electrical-datasheet/excel/excel-documents/${id}/`
      );
      setDocument(response.data);
    } catch (err) {
      console.error('Error fetching document:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchIssues = async () => {
    try {
      const params = new URLSearchParams();
      if (filterSeverity) params.append('severity', filterSeverity);
      if (filterCategory) params.append('category', filterCategory);
      if (selectedSheet) params.append('sheet_name', selectedSheet);

      const response = await apiClient.get(
        `/electrical-datasheet/excel/excel-documents/${id}/issues/?${params.toString()}`
      );
      setIssues(response.data.issues || []);
    } catch (err) {
      console.error('Error fetching issues:', err);
    }
  };

  const fetchParsedData = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSheet) params.append('sheet_name', selectedSheet);
      params.append('group_by_section', 'true');

      const response = await apiClient.get(
        `/electrical-datasheet/excel/excel-documents/${id}/parsed_data/?${params.toString()}`
      );
      setParsedData(response.data);
    } catch (err) {
      console.error('Error fetching parsed data:', err);
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error':
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'info':
        return <InformationCircleIcon className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getSeverityBadge = (severity) => {
    const config = {
      error: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config[severity] || ''}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  const filteredIssues = issues.filter((issue) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        issue.message.toLowerCase().includes(search) ||
        issue.item.toLowerCase().includes(search) ||
        issue.section.toLowerCase().includes(search)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-800">Document Not Found</h3>
          <button
            onClick={() => navigate('/engineering/electrical/datasheet/quality-checker')}
            className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/engineering/electrical/datasheet/quality-checker')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back to Dashboard
        </button>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              <DocumentTextIcon className="h-12 w-12 text-yellow-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{document.filename}</h1>
                <p className="text-gray-600 mt-1">{document.equipment_type_display}</p>
                {document.company_doc_number && (
                  <p className="text-sm text-gray-500 mt-1">
                    Doc #: {document.company_doc_number} | Rev: {document.revision || 'N/A'}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">
                {document.validation_score !== null ? (
                  <span className={document.validation_score >= 70 ? 'text-green-600' : 'text-red-600'}>
                    {document.validation_score}%
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">Validation Score</p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="bg-red-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-700">Errors</span>
                <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-700 mt-2">
                {document.error_count}
              </div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-yellow-700">Warnings</span>
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-yellow-700 mt-2">
                {document.warning_count}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">Info</span>
                <InformationCircleIcon className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-700 mt-2">
                {document.info_count}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {['summary', 'issues', 'parsed_data', 'document_info'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Document Control Information</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {[
                    { label: 'Document Title', value: document.document_title },
                    { label: 'Project Name', value: document.project_name },
                    { label: 'Location', value: document.project_location },
                    { label: 'Agreement Number', value: document.agreement_number },
                    { label: 'Document Status', value: document.doc_status },
                    { label: 'Document Purpose', value: document.doc_purpose },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <dt className="text-sm font-medium text-gray-500">{item.label}</dt>
                      <dd className="mt-1 text-sm text-gray-900">{item.value || '-'}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Sheets in Document</h3>
                <div className="grid grid-cols-2 gap-2">
                  {document.sheet_names && document.sheet_names.map((sheet, idx) => (
                    <div key={idx} className="bg-gray-50 px-3 py-2 rounded text-sm">
                      {sheet}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Issues Tab */}
          {activeTab === 'issues' && (
            <div>
              {/* Filters */}
              <div className="mb-4 flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search issues..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
                    />
                    <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  </div>
                </div>

                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Severities</option>
                  <option value="error">Errors</option>
                  <option value="warning">Warnings</option>
                  <option value="info">Info</option>
                </select>

                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All Categories</option>
                  <option value="document_control">Document Control</option>
                  <option value="technical_content">Technical Content</option>
                  <option value="consistency">Consistency</option>
                  <option value="standards">Standards</option>
                </select>

                {document.sheet_names && document.sheet_names.length > 0 && (
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Sheets</option>
                    {document.sheet_names.map((sheet, idx) => (
                      <option key={idx} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Issues List */}
              <div className="space-y-3">
                {filteredIssues.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircleIcon className="mx-auto h-12 w-12 text-green-500 mb-4" />
                    <p className="text-gray-600">No issues found</p>
                  </div>
                ) : (
                  filteredIssues.map((issue) => (
                    <div
                      key={issue.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          {getSeverityIcon(issue.severity)}
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {getSeverityBadge(issue.severity)}
                              <span className="text-xs text-gray-500">{issue.code}</span>
                              {issue.category && (
                                <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                                  {issue.category.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              {issue.message}
                            </p>
                            <div className="text-xs text-gray-600 space-y-1">
                              {issue.sheet_name && (
                                <div>Sheet: <span className="font-medium">{issue.sheet_name}</span></div>
                              )}
                              {issue.section && (
                                <div>Section: <span className="font-medium">{issue.section}</span></div>
                              )}
                              {issue.item && (
                                <div>Item: <span className="font-medium">{issue.item}</span></div>
                              )}
                              {issue.expected_value && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  <div>
                                    <span className="text-gray-500">Expected:</span>
                                    <div className="text-green-700 font-mono text-xs">
                                      {issue.expected_value}
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Actual:</span>
                                    <div className="text-red-700 font-mono text-xs">
                                      {issue.actual_value || 'Empty'}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Parsed Data Tab */}
          {activeTab === 'parsed_data' && (
            <div>
              {/* Sheet Selector */}
              {document.sheet_names && document.sheet_names.length > 0 && (
                <div className="mb-4">
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Technical Data Sheets</option>
                    {document.sheet_names.map((sheet, idx) => (
                      <option key={idx} value={sheet}>{sheet}</option>
                    ))}
                  </select>
                </div>
              )}

              {parsedData && parsedData.grouped_data ? (
                <div className="space-y-6">
                  {Object.entries(parsedData.grouped_data).map(([section, items]) => (
                    <div key={section} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="bg-gray-100 px-4 py-2 font-semibold text-gray-900">
                        {section}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Description
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Unit
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Specified Design Data
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Vendor Data
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {items.map((item, idx) => (
                              <tr key={idx} className={item.is_section_header ? 'bg-gray-50' : ''}>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {item.description}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {item.unit}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {item.specified_design_data}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-900">
                                  {item.vendor_data}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p>No parsed data available</p>
                </div>
              )}
            </div>
          )}

          {/* Document Info Tab */}
          {activeTab === 'document_info' && (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">File Size</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {(document.file_size / 1024).toFixed(2)} KB
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Uploaded By</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {document.uploaded_by_name || 'Unknown'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Uploaded At</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(document.uploaded_at).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Processing Completed</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {document.processing_completed_at
                      ? new Date(document.processing_completed_at).toLocaleString()
                      : '-'}
                  </dd>
                </div>
              </dl>

              {document.processing_error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">Processing Error</h4>
                  <p className="text-sm text-red-700">{document.processing_error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExcelDocumentDetail;
