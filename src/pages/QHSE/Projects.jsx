import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Filter, Download, RefreshCw, Eye, Calendar, DollarSign, Users, TrendingUp, Building2, UserCircle, CheckCircle2, AlertCircle, Clock, Target } from 'lucide-react';
import { useQHSERunningProjects } from './hooks/useQHSEProjects';
import { MainHeader } from './components/Common/MainHeader';
import { Card, CardContent } from './components/ui/Card';
import { ProjectForm, Toast } from './components/ProjectForm';
import { PROJECT_STATUS_OPTIONS, PRIORITY_OPTIONS } from './utils/projectFormConfig';
import { qhseProjectsAPI } from '../../services/qhse.service';

/**
 * Helper function to parse percentage values
 * Handles strings like "83%" or numbers like 83
 */
const parsePercentage = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Remove % sign and parse as float
    const cleaned = value.replace('%', '').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/**
 * Project Management Page
 * Create, Read, Update, Delete QHSE Running Projects
 */
const Projects = () => {
  const { data: projects = [], loading, error, refetch } = useQHSERunningProjects();
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get status color
  const getStatusColor = (status) => {
    const option = PROJECT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || '#6b7280';
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    const option = PRIORITY_OPTIONS.find(opt => opt.value === priority);
    return option?.color || '#6b7280';
  };

  // Get status label
  const getStatusLabel = (status) => {
    const option = PROJECT_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || status;
  };

  // Get priority label
  const getPriorityLabel = (priority) => {
    const option = PRIORITY_OPTIONS.find(opt => opt.value === priority);
    return option?.label || priority;
  };

  // Filter projects
  const filteredProjects = projects.filter(project => {
    const matchesSearch = !searchQuery || 
      project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.client_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || project.priority === priorityFilter;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Handle create new project
  const handleCreateNew = () => {
    setEditingProject(null);
    setShowForm(true);
  };

  // Handle edit project
  const handleEdit = (project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  // Handle form submit (create or update)
  const handleFormSubmit = async (formData) => {
    try {
      let savedProject;
      
      if (editingProject) {
        // Update existing project
        savedProject = await qhseProjectsAPI.update(editingProject.id, formData);
      } else {
        // Create new project
        savedProject = await qhseProjectsAPI.create(formData);
      }
      
      setToast({
        type: 'success',
        message: editingProject 
          ? `Project "${savedProject.project_name || savedProject.projectTitle}" updated successfully!`
          : `Project "${savedProject.project_name || savedProject.projectTitle}" created successfully!`
      });
      
      setShowForm(false);
      setEditingProject(null);
      refetch(); // Refresh project list
    } catch (error) {
      console.error('Error saving project:', error);
      setToast({
        type: 'error',
        message: error.message || 'Failed to save project. Please try again.'
      });
    }
  };

  // Handle delete project
  const handleDelete = async (project) => {
    if (!confirm(`Are you sure you want to delete project "${project.project_name || project.projectTitle}"? This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    
    try {
      await qhseProjectsAPI.delete(project.id, { hardDelete: true });
      
      setToast({
        type: 'success',
        message: `Project "${project.project_name || project.projectTitle}" deleted successfully!`
      });
      
      refetch(); // Refresh project list
    } catch (error) {
      console.error('Error deleting project:', error);
      setToast({
        type: 'error',
        message: error.message || 'Failed to delete project. Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle export to CSV
  const handleExport = () => {
    const csvContent = [
      // Headers
      ['Project Number', 'Project Name', 'Client', 'Status', 'Priority', 'Start Date', 'End Date', 'Budget', 'Completion %'].join(','),
      // Data rows
      ...filteredProjects.map(p => [
        p.project_number,
        `"${p.project_name}"`,
        `"${p.client_name || ''}"`,
        p.status,
        p.priority,
        p.start_date,
        p.planned_end_date,
        p.budget || 0,
        p.completion_percentage || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qhse-projects-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate summary metrics
  const summaryMetrics = {
    total: projects.length,
    active: projects.filter(p => p.status === 'active' || p.status === 'in_progress' || p.status === 'ongoing').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalBudget: projects.reduce((sum, p) => sum + (parseFloat(p.budget) || 0), 0),
    avgCompletion: projects.length > 0 
      ? projects.reduce((sum, p) => sum + parsePercentage(p.projectKPIsAchievedPercent || p.completion_percentage), 0) / projects.length 
      : 0,
    avgKPI: projects.length > 0
      ? projects.reduce((sum, p) => sum + parsePercentage(p.overall_kpi), 0) / projects.length
      : 0
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <MainHeader
          title="Project Management"
          description="Create, manage, and track QHSE running projects"
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Projects</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryMetrics.total}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Projects</p>
                  <p className="text-2xl font-bold text-green-600">{summaryMetrics.active}</p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Total Budget</p>
                  <p className="text-2xl font-bold text-gray-900">
                    AED {(summaryMetrics.totalBudget / 1000000).toFixed(1)}M
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Avg Completion</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryMetrics.avgCompletion.toFixed(1)}%</p>
                </div>
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Search */}
              <div className="flex-1 w-full lg:max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search projects by name, number, or client..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-3 w-full lg:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  {PROJECT_STATUS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Priority</option>
                  {PRIORITY_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex gap-3 w-full lg:w-auto">
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
                
                <button
                  onClick={refetch}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>

                <button
                  onClick={handleCreateNew}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Project
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects Table */}
        <Card>
          <CardContent className="p-6">
            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
                <p className="text-gray-600">Loading projects...</p>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600 mb-2">Error loading projects</p>
                <p className="text-gray-600 text-sm">{error.message}</p>
                <button
                  onClick={refetch}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">
                  {projects.length === 0 
                    ? 'No projects found. Create your first project to get started.'
                    : 'No projects match your filters.'}
                </p>
                {projects.length === 0 && (
                  <button
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create First Project
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProjects.map(project => (
                  <div
                    key={project.id}
                    className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow duration-200"
                  >
                    {/* Header with Status */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {project.projectTitle || project.project_name}
                        </h3>
                        <p className="text-sm text-gray-500 font-mono">
                          {project.projectNo || project.project_number}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap"
                          style={{ backgroundColor: getStatusColor(project.status) }}
                        >
                          {getStatusLabel(project.status)}
                        </span>
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium text-white whitespace-nowrap"
                          style={{ backgroundColor: getPriorityColor(project.priority) }}
                        >
                          {getPriorityLabel(project.priority)}
                        </span>
                      </div>
                    </div>

                    {/* Client & Team Info */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-700 font-medium">Client:</span>
                        <span className="text-gray-900 truncate">
                          {project.client || project.client_name || '-'}
                        </span>
                      </div>
                      
                      {(project.projectManager || project.project_manager) && (
                        <div className="flex items-center gap-2 text-sm">
                          <UserCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                          <span className="text-gray-700 font-medium">PM:</span>
                          <span className="text-gray-900 truncate">
                            {project.projectManager || project.project_manager}
                          </span>
                        </div>
                      )}
                      
                      {(project.projectQualityEng || project.quality_engineer) && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-gray-700 font-medium">QE:</span>
                          <span className="text-gray-900 truncate">
                            {project.projectQualityEng || project.quality_engineer}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Timeline */}
                    <div className="bg-gray-50 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">Timeline</span>
                        </div>
                        <Clock className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-700">
                          Start: {project.projectStartingDate || project.start_date || '-'}
                        </span>
                        <span className="text-gray-700">
                          End: {project.projectEndDate || project.planned_end_date || '-'}
                        </span>
                      </div>
                    </div>

                    {/* Progress Metrics */}
                    <div className="space-y-3 mb-4">
                      {/* Completion Progress */}
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600 font-medium">Completion</span>
                          <span className="text-blue-600 font-bold">
                            {parsePercentage(project.projectKPIsAchievedPercent || project.completion_percentage).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min(parsePercentage(project.projectKPIsAchievedPercent || project.completion_percentage), 100)}%` 
                            }}
                          />
                        </div>
                      </div>

                      {/* KPI Performance */}
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <div className="flex items-center gap-1">
                            <Target className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-600 font-medium">Overall KPI</span>
                          </div>
                          <span className={`font-bold ${
                            parsePercentage(project.overall_kpi) >= 80 ? 'text-green-600' :
                            parsePercentage(project.overall_kpi) >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {parsePercentage(project.overall_kpi).toFixed(1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-300 ${
                              parsePercentage(project.overall_kpi) >= 80 ? 'bg-gradient-to-r from-green-500 to-green-600' :
                              parsePercentage(project.overall_kpi) >= 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' :
                              'bg-gradient-to-r from-red-500 to-red-600'
                            }`}
                            style={{ 
                              width: `${Math.min(parsePercentage(project.overall_kpi), 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Key Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-4 pt-4 border-t border-gray-200">
                      <div className="text-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg mx-auto mb-1">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <p className="text-xs text-gray-500 mb-1">CAR Closed</p>
                        <p className="text-sm font-bold text-gray-900">
                          {project.carsClosed || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-yellow-100 rounded-lg mx-auto mb-1">
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                        </div>
                        <p className="text-xs text-gray-500 mb-1">CAR Open</p>
                        <p className="text-sm font-bold text-gray-900">
                          {project.carsOpen || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg mx-auto mb-1">
                          <Eye className="w-5 h-5 text-blue-600" />
                        </div>
                        <p className="text-xs text-gray-500 mb-1">Obs Open</p>
                        <p className="text-sm font-bold text-gray-900">
                          {project.obsOpen || 0}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => handleEdit(project)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(project)}
                        disabled={isDeleting}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Count */}
        {!loading && !error && filteredProjects.length > 0 && (
          <p className="text-sm text-gray-600 text-center">
            Showing {filteredProjects.length} of {projects.length} projects
          </p>
        )}
      </div>

      {/* Project Form Modal */}
      {showForm && (
        <ProjectForm
          project={editingProject}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingProject(null);
          }}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
};

export default Projects;
