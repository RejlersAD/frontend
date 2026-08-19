import React, { useState, useEffect } from 'react';
import { 
  ShieldCheckIcon, 
  TableCellsIcon, 
  ChartBarIcon,
  DocumentTextIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { RefreshCw, Maximize2, Download, Filter } from 'lucide-react';
import { 
  IconButton, 
  Tooltip, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  MenuItem,
  Box,
  Button,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from '@mui/material';
import { qhseProjectsAPI } from '../../services/qhse.service';
import * as XLSX from 'xlsx';
import NewProjectModal from './components/NewProjectModal';

/**
 * Project Quality Details - 8.2
 * 
 * A comprehensive application for detailed project quality analysis and reporting.
 * This module provides RBAC-controlled access to detailed quality metrics, trends, and insights.
 * 
 * RBAC Integration:
 * - Module Code: qhse_detailed
 * - Requires: User must have qhse_detailed module assigned to their role
 * - Visibility: Controlled by TeamCollaborationMixin and DataVisibilityMixin
 * 
 * Features:
 * - Detailed quality metrics and KPI tracking
 * - Advanced filtering and search capabilities
 * - Export functionality for reports
 * - Real-time data refresh
 * - Fullscreen mode for presentations
 * - Integration with Django backend API
 */

const ProjectQualityDetails = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterManager, setFilterManager] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    avgQuality: 0,
    activeIssues: 0,
    compliance: 0,
  });
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(null);

  // Fetch data on component mount
  useEffect(() => {
    fetchProjects();
  }, []);

  // Apply filters when data or filters change
  useEffect(() => {
    applyFilters();
  }, [projects, searchQuery, filterClient, filterManager, filterStatus]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await qhseProjectsAPI.getAll();
      
      // Defensive check: Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('API returned non-array data:', data);
        throw new Error('Invalid data format received from API');
      }
      
      setProjects(data);
      calculateStats(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err.message || 'Failed to load projects');
      setProjects([]); // Set empty array on error
      setFilteredProjects([]); // Reset filtered projects
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchProjects().finally(() => setIsRefreshing(false));
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const calculateStats = (data) => {
    // Defensive check: ensure data is an array
    if (!Array.isArray(data) || data.length === 0) {
      setStats({
        total: 0,
        avgQuality: 0,
        activeIssues: 0,
        compliance: 0,
      });
      return;
    }
    
    const total = data.length;
    const avgQuality = data.reduce((sum, p) => {
      const quality = parseFloat(p.projectKPIsAchievedPercent || 0);
      return sum + quality;
    }, 0) / total;
    const activeIssues = data.reduce((sum, p) => sum + (p.carsOpen || 0) + (p.obsOpen || 0), 0);
    const avgCompletion = data.reduce((sum, p) => {
      const completion = parseFloat(p.projectCompletionPercent || 0);
      return sum + completion;
    }, 0) / total;

    setStats({
      total,
      avgQuality: avgQuality.toFixed(1),
      activeIssues,
      compliance: avgCompletion.toFixed(1),
    });
  };

  const applyFilters = () => {
    // Defensive check: ensure projects is an array
    if (!Array.isArray(projects)) {
      setFilteredProjects([]);
      return;
    }
    
    let filtered = [...projects];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.projectNo?.toLowerCase().includes(query) ||
        p.projectTitle?.toLowerCase().includes(query) ||
        p.client?.toLowerCase().includes(query)
      );
    }

    // Client filter
    if (filterClient) {
      filtered = filtered.filter(p => p.client === filterClient);
    }

    // Manager filter
    if (filterManager) {
      filtered = filtered.filter(p => p.projectManager === filterManager);
    }

    // Status filter
    if (filterStatus !== 'all') {
      const now = new Date();
      filtered = filtered.filter(p => {
        const closingDate = p.projectExtension || p.projectClosingDate;
        if (!closingDate) return filterStatus === 'active';
        const isOverdue = new Date(closingDate) < now;
        if (filterStatus === 'overdue') return isOverdue;
        if (filterStatus === 'active') return !isOverdue;
        return true;
      });
    }

    setFilteredProjects(filtered);
    setPage(0);
  };

  const handleExport = () => {
    try {
      const exportData = filteredProjects.map(p => ({
        'Sr No': p.srNo,
        'Project No': String(p.projectNo || '').replace(/\.0$/, ''),
        'Project Title': p.projectTitle,
        'Client': p.client,
        'Project Manager': p.projectManager,
        'Quality Engineer': p.projectQualityEng || '',
        'Starting Date': p.projectStartingDate || '',
        'Closing Date': p.projectClosingDate || '',
        'Extension': p.projectExtension || '',
        'Quality Plan Rev': p.projectQualityPlanStatusRev || '',
        'CARs Open': p.carsOpen || 0,
        'CARs Closed': p.carsClosed || 0,
        'Obs Open': p.obsOpen || 0,
        'Obs Closed': p.obsClosed || 0,
        'KPIs Achieved %': p.projectKPIsAchievedPercent || '0',
        'Completion %': p.projectCompletionPercent || '0',
        'Rejection %': p.rejectionOfDeliverablesPercent || '',
        'Cost of Poor Quality (AED)': p.costOfPoorQualityAED || 0,
        'Remarks': p.remarks || '',
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'QHSE Projects');
      XLSX.writeFile(wb, `QHSE_Running_Projects_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data');
    }
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const getStatusChip = (project) => {
    const closingDate = project.projectExtension || project.projectClosingDate;
    if (!closingDate) return <Chip label="No Date" size="small" />;
    
    const isOverdue = new Date(closingDate) < new Date();
    return (
      <Chip 
        label={isOverdue ? 'Overdue' : 'Active'} 
        color={isOverdue ? 'error' : 'success'} 
        size="small" 
      />
    );
  };

  const handleProjectCreated = (newProject) => {
    // Refresh the project list after successful creation
    fetchProjects();
    
    // Show success message (optional - could add a toast/snackbar)
    console.log('Project created successfully:', newProject);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setEditModalOpen(true);
  };

  const handleProjectUpdated = (updatedProject) => {
    // Refresh the project list after successful update
    fetchProjects();
    setEditModalOpen(false);
    setEditingProject(null);
    console.log('Project updated successfully:', updatedProject);
  };

  const handleDeleteClick = (project) => {
    setDeletingProject(project);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProject) return;

    try {
      setLoading(true);
      await qhseProjectsAPI.delete(deletingProject.id);
      
      // Refresh the project list after successful deletion
      await fetchProjects();
      
      setDeleteDialogOpen(false);
      setDeletingProject(null);
      console.log('Project deleted successfully:', deletingProject.projectNo);
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err.message || 'Failed to delete project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeletingProject(null);
  };

  // Defensive checks: Ensure projects is an array before mapping
  const uniqueClients = Array.isArray(projects) 
    ? [...new Set(projects.map(p => p.client).filter(Boolean))]
    : [];
  const uniqueManagers = Array.isArray(projects)
    ? [...new Set(projects.map(p => p.projectManager).filter(Boolean))]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-slate-50 p-6">
      {/* Header Section */}
      <div className="max-w-[1920px] mx-auto">
        {/* Title and Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg">
              <TableCellsIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                8.2 Project Quality Details
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive project quality analysis and reporting
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Tooltip title="Refresh Data">
              <IconButton 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="hover:bg-blue-50"
              >
                <RefreshCw className={`w-5 h-5 text-gray-700 ${isRefreshing ? 'animate-spin' : ''}`} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Fullscreen">
              <IconButton 
                onClick={toggleFullscreen}
                className="hover:bg-blue-50"
              >
                <Maximize2 className="w-5 h-5 text-gray-700" />
              </IconButton>
            </Tooltip>

            <button 
              onClick={() => setNewProjectModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              New Project
            </button>

            <button 
              onClick={handleExport}
              disabled={filteredProjects.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Export Report
            </button>
          </div>
        </div>

        {/* Quick Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Projects"
            value={stats.total.toString()}
            icon={DocumentTextIcon}
            color="blue"
            trend={`${stats.total} active`}
          />
          <StatCard
            title="Avg Quality Score"
            value={`${stats.avgQuality}%`}
            icon={ShieldCheckIcon}
            color="green"
            trend="KPIs achieved"
          />
          <StatCard
            title="Active Issues"
            value={stats.activeIssues.toString()}
            icon={ExclamationTriangleIcon}
            color="yellow"
            trend="CARs & Obs"
          />
          <StatCard
            title="Avg Completion"
            value={`${stats.compliance}%`}
            icon={CheckCircleIcon}
            color="purple"
            trend="project progress"
          />
        </div>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" className="mb-6" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200">
          {/* Filters and Search Bar */}
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <TextField
                size="small"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 mr-2" />
                }}
                fullWidth
              />

              {/* Client Filter */}
              <TextField
                select
                size="small"
                label="Filter by Client"
                value={filterClient}
                onChange={(e) => setFilterClient(e.target.value)}
                fullWidth
              >
                <MenuItem value="">All Clients</MenuItem>
                {uniqueClients.map(client => (
                  <MenuItem key={client} value={client}>{client}</MenuItem>
                ))}
              </TextField>

              {/* Manager Filter */}
              <TextField
                select
                size="small"
                label="Filter by Manager"
                value={filterManager}
                onChange={(e) => setFilterManager(e.target.value)}
                fullWidth
              >
                <MenuItem value="">All Managers</MenuItem>
                {uniqueManagers.map(manager => (
                  <MenuItem key={manager} value={manager}>{manager}</MenuItem>
                ))}
              </TextField>

              {/* Status Filter */}
              <TextField
                select
                size="small"
                label="Status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                fullWidth
              >
                <MenuItem value="all">All Projects</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
              </TextField>
            </div>
          </div>

          {/* Loading State */}
          {loading && <LinearProgress />}

          {/* Data Table Section */}
          {!loading && (
            <div className="p-6">
              {/* Scroll Hint */}
              <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span>💡 <strong>Tip:</strong> Use horizontal scroll (below table) or drag to view all 11 columns</span>
              </div>

              <TableContainer 
                component={Paper} 
                sx={{ 
                  maxHeight: 'calc(100vh - 450px)', 
                  overflowX: 'auto',
                  overflowY: 'auto',
                  boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  '&::-webkit-scrollbar': {
                    width: '12px',
                    height: '12px',
                  },
                  '&::-webkit-scrollbar-track': {
                    background: '#f3f4f6',
                    borderRadius: '6px',
                  },
                  '&::-webkit-scrollbar-thumb': {
                    background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
                    borderRadius: '6px',
                    border: '2px solid #f3f4f6',
                  },
                  '&::-webkit-scrollbar-thumb:hover': {
                    background: 'linear-gradient(180deg, #4f46e5 0%, #4338ca 100%)',
                  },
                  '&::-webkit-scrollbar-corner': {
                    background: '#f3f4f6',
                  },
                }}
              >
                <Table stickyHeader sx={{ minWidth: 1400 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 80 }}>Sr No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 130 }}>Project No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 350 }}>Project Title</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 180 }}>Client</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 180 }}>Manager</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 100 }}>Status</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 100 }}>CARs</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 100 }}>Obs</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 120 }}>Completion %</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 120 }}>Quality %</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 'bold', backgroundColor: '#f9fafb', minWidth: 130 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredProjects.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} align="center" className="py-12">
                          <div className="flex flex-col items-center justify-center text-center">
                            <DocumentTextIcon className="w-16 h-16 text-gray-300 mb-3" />
                            <p className="text-gray-500">No projects found</p>
                            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProjects
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((project) => (
                          <TableRow key={project.id} hover className="cursor-pointer">
                            <TableCell>{project.srNo}</TableCell>
                            <TableCell>
                              <span className="font-mono text-sm text-indigo-600">
                                {String(project.projectNo || '').replace(/\.0$/, '')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div style={{ maxWidth: '350px', minWidth: '250px' }}>
                                <p className="font-medium text-gray-900" style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
                                  {project.projectTitle}
                                </p>
                                {project.projectQualityEng && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    QE: {project.projectQualityEng}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{project.client}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{project.projectManager}</span>
                            </TableCell>
                            <TableCell>{getStatusChip(project)}</TableCell>
                            <TableCell align="center">
                              <div className="flex flex-col items-center">
                                <span className="text-sm font-medium">
                                  {project.carsOpen || 0} / {project.totalCars || 0}
                                </span>
                                <span className="text-xs text-gray-500">open/total</span>
                              </div>
                            </TableCell>
                            <TableCell align="center">
                              <div className="flex flex-col items-center">
                                <span className="text-sm font-medium">
                                  {project.obsOpen || 0} / {project.totalObs || 0}
                                </span>
                                <span className="text-xs text-gray-500">open/total</span>
                              </div>
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={project.projectCompletionPercent || '0%'} 
                                size="small"
                                color={parseFloat(project.projectCompletionPercent || 0) >= 90 ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={project.projectKPIsAchievedPercent || '0%'} 
                                size="small"
                                color={parseFloat(project.projectKPIsAchievedPercent || 0) >= 80 ? 'success' : 'warning'}
                              />
                            </TableCell>                            <TableCell align="center">
                              <div className="flex items-center justify-center gap-2">
                                <Tooltip title="Edit Project">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleEdit(project)}
                                    sx={{ 
                                      color: '#4f46e5',
                                      '&:hover': { backgroundColor: '#eef2ff' }
                                    }}
                                  >
                                    <PencilIcon className="w-5 h-5" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete Project">
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleDeleteClick(project)}
                                    sx={{ 
                                      color: '#dc2626',
                                      '&:hover': { backgroundColor: '#fef2f2' }
                                    }}
                                  >
                                    <TrashIcon className="w-5 h-5" />
                                  </IconButton>
                                </Tooltip>
                              </div>
                            </TableCell>                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              <Box sx={{ mt: 2 }}>
                <TablePagination
                  component="div"
                  count={filteredProjects.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[5, 10, 25, 50, 100]}
                  sx={{
                    borderTop: '1px solid #e5e7eb',
                    pt: 1,
                  }}
                />
              </Box>
            </div>
          )}
        </div>

        {/* Info Banner */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <ShieldCheckIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-blue-900 font-medium">RBAC Integration Active</p>
              <p className="text-sm text-blue-700 mt-1">
                This application is protected by the RBAC system. Users need the <strong>qhse_detailed</strong> module 
                assigned to their role to access this page. Showing {filteredProjects.length} of {stats.total} projects.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* New Project Modal */}
      <NewProjectModal
        open={newProjectModalOpen}
        onClose={() => setNewProjectModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Edit Project Modal */}
      <NewProjectModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setEditingProject(null);
        }}
        onProjectCreated={handleProjectUpdated}
        editMode={true}
        projectData={editingProject}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 'bold', color: '#dc2626' }}>
          Delete Project
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this project?
          </DialogContentText>
          {deletingProject && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#fef2f2', borderRadius: 1, border: '1px solid #fecaca' }}>
              <p className="text-sm font-medium text-gray-900">
                <strong>Project No:</strong> {String(deletingProject.projectNo || '').replace(/\.0$/, '')}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <strong>Title:</strong> {deletingProject.projectTitle}
              </p>
              <p className="text-sm text-gray-700 mt-1">
                <strong>Client:</strong> {deletingProject.client}
              </p>
            </Box>
          )}
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. The project will be permanently deleted from the database.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button 
            onClick={handleDeleteCancel}
            variant="outlined"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm}
            variant="contained"
            color="error"
            startIcon={<TrashIcon className="w-5 h-5" />}
          >
            Delete Project
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, trend }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium mb-2">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-2">{trend}</p>
        </div>
        <div className={`p-3 bg-gradient-to-br ${colorClasses[color]} rounded-lg`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export default ProjectQualityDetails;
