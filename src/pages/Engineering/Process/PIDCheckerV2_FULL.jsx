/**
 * P&ID Checker V2 — AI-Powered Multi-Document Validation Engine
 * 
 * Features:
 * - Multi-document upload (P&ID, Legends, Equipment List, Line List, Instrument Index)
 * - Real-time extraction status tracking
 * - Knowledge graph visualization
 * - Cross-document comparison findings
 * - Interactive finding resolution
 * - Excel export
 * 
 * ISOLATED from V1 (/engineering/process/pid-verification)
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Upload, FileText, AlertCircle, CheckCircle, Clock, Database,
  Search, Filter, Download, Network, Eye, XCircle, Loader
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Soft-coded constants
const MAX_FILE_SIZE_MB = 50;
const POLLING_INTERVAL_MS = 3000;
const SEVERITY_COLORS = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  LOW: 'bg-blue-100 text-blue-800 border-blue-300',
  INFO: 'bg-gray-100 text-gray-800 border-gray-300'
};

const PIDCheckerV2 = () => {
  // State management
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  
  // Project details
  const [documents, setDocuments] = useState([]);
  const [entities, setEntities] = useState({ equipment: [], lines: [], instruments: [], valves: [], symbols: [] });
  const [findings, setFindings] = useState([]);
  const [filteredFindings, setFilteredFindings] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [extractionStatus, setExtractionStatus] = useState(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState('upload'); // upload, projects, documents, entities, findings, graph
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(null);
  
  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);
  
  // Poll extraction status
  useEffect(() => {
    let interval;
    if (currentProject && ['pending', 'processing'].includes(currentProject.extraction_status)) {
      interval = setInterval(() => {
        refreshProjectStatus();
      }, POLLING_INTERVAL_MS);
    }
    return () => clearInterval(interval);
  }, [currentProject]);
  
  // Filter findings
  useEffect(() => {
    applyFilters();
  }, [findings, severityFilter, statusFilter, searchQuery]);
  
  // API Functions
  const loadProjects = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v2/pid-checker/projects/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
      });
      setProjects(response.data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };
  
  const refreshProjectStatus = async () => {
    if (!currentProject) return;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v2/pid-checker/projects/${currentProject.id}/`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setCurrentProject(response.data);
      setStatistics(response.data.statistics);
      
      // If completed, load findings
      if (response.data.extraction_status === 'completed') {
        loadFindings();
      }
    } catch (error) {
      console.error('Failed to refresh project status:', error);
    }
  };
  
  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !projectName.trim()) {
      alert('Please provide a project name and select at least one file.');
      return;
    }
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('name', projectName);
      formData.append('description', projectDescription);
      
      selectedFiles.forEach(file => {
        formData.append('documents', file);
      });
      
      const response = await axios.post(
        `${API_BASE_URL}/api/v2/pid-checker/projects/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      setCurrentProject(response.data);
      setProjectName('');
      setProjectDescription('');
      setSelectedFiles([]);
      setActiveTab('projects');
      loadProjects();
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  const loadProjectDetails = async (projectId) => {
    try {
      const [projectRes, entitiesRes, findingsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/v2/pid-checker/projects/${projectId}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
        }),
        axios.get(`${API_BASE_URL}/api/v2/pid-checker/projects/${projectId}/entities/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
        }),
        axios.get(`${API_BASE_URL}/api/v2/pid-checker/projects/${projectId}/findings/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` }
        })
      ]);
      
      setCurrentProject(projectRes.data);
      setStatistics(projectRes.data.statistics);
      setDocuments(projectRes.data.documents);
      setEntities(entitiesRes.data);
      setFindings(findingsRes.data);
      setActiveTab('findings');
    } catch (error) {
      console.error('Failed to load project details:', error);
    }
  };
  
  const loadFindings = async () => {
    if (!currentProject) return;
    
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v2/pid-checker/projects/${currentProject.id}/findings/`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      setFindings(response.data);
    } catch (error) {
      console.error('Failed to load findings:', error);
    }
  };
  
  const resolveFinding = async (findingId, resolutionNotes) => {
    try {
      await axios.post(
        `${API_BASE_URL}/api/v2/pid-checker/findings/${findingId}/resolve/`,
        { resolution_notes: resolutionNotes },
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` } }
      );
      loadFindings();
    } catch (error) {
      console.error('Failed to resolve finding:', error);
    }
  };
  
  const applyFilters = () => {
    let filtered = [...findings];
    
    if (severityFilter !== 'all') {
      filtered = filtered.filter(f => f.severity === severityFilter);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(f => f.status === statusFilter);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(f =>
        f.finding_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.affected_tag?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredFindings(filtered);
  };
  
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Validate file sizes
    const oversized = files.filter(f => f.size > MAX_FILE_SIZE_MB * 1024 * 1024);
    if (oversized.length > 0) {
      alert(`Some files exceed ${MAX_FILE_SIZE_MB}MB limit and were not added.`);
      return;
    }
    
    setSelectedFiles(files);
  };
  
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  // Render Functions
  const renderUploadTab = () => (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create New Project</h2>
        <p className="text-gray-600">Upload P&ID drawings and supporting documents for AI-powered validation</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Project Name *</label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., PJ6-EXD-MRI-BQDA Package"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
          <textarea
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Optional project description"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Documents *</label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600 mb-1">Click to upload or drag and drop</p>
              <p className="text-sm text-gray-500">
                P&ID, Legends, Equipment List, Line List, Instrument Index
              </p>
              <p className="text-xs text-gray-400 mt-1">Max {MAX_FILE_SIZE_MB}MB per file</p>
            </label>
          </div>
        </div>
        
        {selectedFiles.length > 0 && (
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-lg">
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <button
          onClick={handleUpload}
          disabled={uploading || selectedFiles.length === 0 || !projectName.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center space-x-2"
        >
          {uploading ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span>Create Project & Start Processing</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
  
  const renderProjectsTab = () => (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">All Projects</h2>
      
      {projects.length === 0 ? (
        <div className="text-center py-12">
          <Database className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No projects yet. Create your first project above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <div
              key={project.id}
              onClick={() => loadProjectDetails(project.id)}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{project.name}</h3>
                {project.extraction_status === 'completed' && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {project.extraction_status === 'processing' && (
                  <Clock className="w-5 h-5 text-yellow-500 animate-pulse" />
                )}
                {project.extraction_status === 'failed' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              
              <p className="text-sm text-gray-600 mb-3">{project.description || 'No description'}</p>
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{project.document_count} documents</span>
                <span>{project.finding_count} findings</span>
              </div>
              
              <div className="mt-2 text-xs text-gray-400">
                {new Date(project.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
  
  const renderFindingsTab = () => (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Validation Findings</h2>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
              <option value="INFO">Info</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="under_review">Under Review</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search findings, tags..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        
        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-700">{statistics.findings.by_severity.CRITICAL || 0}</div>
              <div className="text-xs text-red-600">Critical</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-700">{statistics.findings.by_severity.HIGH || 0}</div>
              <div className="text-xs text-orange-600">High</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-700">{statistics.findings.by_severity.MEDIUM || 0}</div>
              <div className="text-xs text-yellow-600">Medium</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{statistics.findings.by_severity.LOW || 0}</div>
              <div className="text-xs text-blue-600">Low</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{statistics.findings.resolved || 0}</div>
              <div className="text-xs text-green-600">Resolved</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Findings Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Finding ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredFindings.map(finding => (
              <tr key={finding.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-900">{finding.finding_id}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full border ${SEVERITY_COLORS[finding.severity]}`}>
                    {finding.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{finding.category.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-sm font-mono text-blue-600">{finding.affected_tag || 'N/A'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-md truncate">{finding.description}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${finding.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {finding.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelectedFinding(finding)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {filteredFindings.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">No findings match your filters</p>
        </div>
      )}
    </div>
  );
  
  // Main render
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">P&ID Checker V2</h1>
          <p className="text-gray-600">AI-Powered Multi-Document Validation Engine</p>
        </div>
        
        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          {['upload', 'projects', 'findings'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-medium capitalize transition ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Content */}
        {activeTab === 'upload' && renderUploadTab()}
        {activeTab === 'projects' && renderProjectsTab()}
        {activeTab === 'findings' && renderFindingsTab()}
        
        {/* Finding Detail Modal */}
        {selectedFinding && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedFinding.finding_id}</h3>
                  <span className={`inline-block mt-2 px-3 py-1 text-sm font-semibold rounded-full border ${SEVERITY_COLORS[selectedFinding.severity]}`}>
                    {selectedFinding.severity}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFinding(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <p className="text-gray-900">{selectedFinding.category.replace(/_/g, ' ')}</p>
                </div>
                
                {selectedFinding.affected_tag && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Affected Tag</label>
                    <p className="text-gray-900 font-mono">{selectedFinding.affected_tag}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <p className="text-gray-900">{selectedFinding.description}</p>
                </div>
                
                {selectedFinding.ai_reasoning && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">AI Reasoning</label>
                    <p className="text-gray-700 text-sm bg-blue-50 p-3 rounded-lg">{selectedFinding.ai_reasoning}</p>
                  </div>
                )}
                
                {selectedFinding.suggested_fix && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Suggested Fix</label>
                    <p className="text-gray-700 text-sm bg-green-50 p-3 rounded-lg">{selectedFinding.suggested_fix}</p>
                  </div>
                )}
                
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <span className="text-sm text-gray-500">Confidence: </span>
                    <span className="text-sm font-semibold text-gray-900">{selectedFinding.confidence.toFixed(1)}%</span>
                  </div>
                  
                  {selectedFinding.status !== 'resolved' && (
                    <button
                      onClick={() => {
                        const notes = prompt('Resolution notes:');
                        if (notes) {
                          resolveFinding(selectedFinding.id, notes);
                          setSelectedFinding(null);
                        }
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                      Mark as Resolved
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PIDCheckerV2;
