import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import apiClient from '../../../services/api.service';

/**
 * Excel Documents Dashboard
 * Lists all uploaded documents with filters and status
 */
const ExcelDocumentsDashboard = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEquipmentType, setFilterEquipmentType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState('uploaded_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchDocuments();
  }, [filterEquipmentType, filterStatus, sortBy, sortOrder]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (filterEquipmentType) params.append('equipment_type', filterEquipmentType);
      if (filterStatus) params.append('status', filterStatus);
      if (searchTerm) params.append('search', searchTerm);
      
      const ordering = sortOrder === 'desc' ? `-${sortBy}` : sortBy;
      params.append('ordering', ordering);

      const response = await apiClient.get(
        `/electrical-datasheet/excel/excel-documents/?${params.toString()}`
      );
      
      setDocuments(response.data.results || response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchDocuments();
  };

  const handleDocumentClick = (documentId) => {
    navigate(`/engineering/electrical/datasheet/quality-checker/${documentId}`);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'gray', icon: ClockIcon, text: 'Pending' },
      processing: { color: 'blue', icon: ClockIcon, text: 'Processing' },
      validated: { color: 'green', icon: CheckCircleIcon, text: 'Validated' },
      failed: { color: 'red', icon: ExclamationCircleIcon, text: 'Failed' },
      error: { color: 'red', icon: ExclamationCircleIcon, text: 'Error' },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-100 text-${config.color}-800`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.text}
      </span>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Excel Quality Checker Dashboard
        </h1>
        <p className="text-gray-600">
          View and manage uploaded electrical datasheets
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by filename, document number..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
              />
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>

          {/* Equipment Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Equipment Type
            </label>
            <select
              value={filterEquipmentType}
              onChange={(e) => setFilterEquipmentType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value="">All Types</option>
              <option value="ups">UPS</option>
              <option value="vfd">VFD</option>
              <option value="power_cable">Power Cable</option>
              <option value="control_cable">Control Cable</option>
              <option value="earthing_cable">Earthing Cable</option>
              <option value="ner">NER</option>
              <option value="transformer">Transformer</option>
              <option value="motor">Motor</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="validated">Validated</option>
              <option value="failed">Failed</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        {/* Sort */}
        <div className="flex items-center space-x-4 mt-4">
          <FunnelIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-yellow-500 focus:border-yellow-500"
          >
            <option value="uploaded_at">Upload Date</option>
            <option value="validation_score">Validation Score</option>
            <option value="error_count">Error Count</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading documents...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <ExclamationCircleIcon className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchDocuments}
              className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Retry
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600">No documents found</p>
            <button
              onClick={() => navigate('/engineering/electrical/datasheet/quality-checker/upload')}
              className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
            >
              Upload First Document
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Equipment Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revision
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issues
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    onClick={() => handleDocumentClick(doc.id)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {doc.filename}
                          </div>
                          {doc.company_doc_number && (
                            <div className="text-xs text-gray-500">
                              {doc.company_doc_number}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {doc.equipment_type_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {doc.revision || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(doc.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {doc.validation_score !== null ? (
                        <div className="flex items-center">
                          <ChartBarIcon className="h-4 w-4 mr-1 text-gray-400" />
                          <span className={`text-sm font-semibold ${getScoreColor(doc.validation_score)}`}>
                            {doc.validation_score}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-4 text-sm">
                        {doc.error_count > 0 && (
                          <span className="text-red-600 font-medium">
                            {doc.error_count} errors
                          </span>
                        )}
                        {doc.warning_count > 0 && (
                          <span className="text-yellow-600 font-medium">
                            {doc.warning_count} warnings
                          </span>
                        )}
                        {doc.error_count === 0 && doc.warning_count === 0 && (
                          <span className="text-gray-400">No issues</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </div>
                      <div className="text-xs">
                        {doc.uploaded_by_name || 'Unknown'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => navigate('/engineering/electrical/datasheet/quality-checker/upload')}
          className="px-6 py-3 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 font-medium transition-colors"
        >
          + Upload New Document
        </button>
      </div>
    </div>
  );
};

export default ExcelDocumentsDashboard;
